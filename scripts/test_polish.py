"""
Tests for polish.py — AI polishing script for work journal summaries.

TDD seams tested:
  S1: find_unpolished()  — discover items needing polish
  S2: build_polish_prompt() — prompt template with 国企文风
  S3: call_ai_api()      — API call with retry logic
  S4: apply_polish()     — write polished text back to data
  S5: load_config()      — read .env configuration
  S6: roundtrip           — full JSON integrity after processing
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure the script directory is on sys.path so we can import polish
sys.path.insert(0, str(Path(__file__).resolve().parent))

import polish


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_data():
    """A minimal but complete data.json fixture covering all three archive types."""
    return {
        "version": 1,
        "lastModified": "2026-07-20T10:00:00+08:00",
        "settings": {
            "weeklySummaryDay": 5,
            "monthlySummaryDay": 28,
            "aiPolishFlag": True,
            "categories": ["人员调配", "内部招聘", "奖惩管理"],
        },
        "projects": [],
        "tasks": [],
        "archives": {
            "weeks": {
                "2026-W28": {
                    "tasks": ["task-1"],
                    "summary": "本周完成了3项人员调配工作，推进了内部招聘流程。",
                    "aiPolished": False,
                },
                "2026-W29": {
                    "tasks": ["task-2"],
                    "summary": "完成绩效数据整理，共处理15份考核表。",
                    "aiPolished": True,  # already polished — should be skipped
                },
                "2026-W30": {
                    "tasks": [],
                    # no summary — should be skipped
                    "aiPolished": False,
                },
            },
            "months": {
                "2026-07": {
                    "tasks": ["task-3", "task-4"],
                    "summary": "本月完成内部招聘2人，处理劳动合同续签5份。",
                    "aiPolished": False,
                },
            },
            "years": {
                "2026": {
                    "tasks": ["task-5"],
                    "summary": "全年围绕人力资源六大模块开展工作，重点推进人员配置优化。",
                    "aiPolished": False,
                },
            },
        },
    }


@pytest.fixture
def sample_data_all_polished():
    """Data where everything is already polished or has no summary."""
    return {
        "version": 1,
        "lastModified": "2026-07-20T10:00:00+08:00",
        "settings": {},
        "projects": [],
        "tasks": [],
        "archives": {
            "weeks": {
                "2026-W28": {
                    "tasks": ["task-1"],
                    "summary": "已完成",
                    "aiPolished": True,
                },
            },
            "months": {},
            "years": {},
        },
    }


# ---------------------------------------------------------------------------
# S1: find_unpolished
# ---------------------------------------------------------------------------

class TestFindUnpolished:
    """S1 — Given parsed data.json, return items where summary exists and aiPolished is False."""

    def test_finds_unpolished_across_all_types(self, sample_data):
        items = polish.find_unpolished(sample_data)

        assert len(items) == 3

        types_found = {item["type"] for item in items}
        assert types_found == {"week", "month", "year"}

    def test_each_item_has_required_keys(self, sample_data):
        items = polish.find_unpolished(sample_data)

        for item in items:
            assert "type" in item
            assert "key" in item
            assert "summary" in item
            assert item["type"] in ("week", "month", "year")
            assert isinstance(item["key"], str)
            assert isinstance(item["summary"], str)

    def test_skips_already_polished(self, sample_data):
        items = polish.find_unpolished(sample_data)
        # W29 is aiPolished=True — should not appear
        keys = [(it["type"], it["key"]) for it in items]
        assert ("week", "2026-W29") not in keys

    def test_skips_missing_summary(self, sample_data):
        items = polish.find_unpolished(sample_data)
        # W30 has no summary
        keys = [(it["type"], it["key"]) for it in items]
        assert ("week", "2026-W30") not in keys

    def test_returns_empty_when_none_to_polish(self, sample_data_all_polished):
        items = polish.find_unpolished(sample_data_all_polished)
        assert items == []

    def test_handles_empty_archives(self):
        data = {
            "version": 1,
            "lastModified": "",
            "settings": {},
            "projects": [],
            "tasks": [],
            "archives": {"weeks": {}, "months": {}, "years": {}},
        }
        assert polish.find_unpolished(data) == []

    def test_handles_missing_archives_key(self):
        data = {"version": 1, "lastModified": "", "settings": {}, "projects": [], "tasks": []}
        assert polish.find_unpolished(data) == []


# ---------------------------------------------------------------------------
# S2: build_polish_prompt
# ---------------------------------------------------------------------------

class TestBuildPolishPrompt:
    """S2 — Generate AI prompt with 国企人力资源文风 template."""

    def test_includes_summary_text(self):
        prompt = polish.build_polish_prompt("完成了3项人员调配工作。")
        assert "完成了3项人员调配工作。" in prompt

    def test_includes_style_requirements(self):
        prompt = polish.build_polish_prompt("任意文本")
        # Must mention the required style keywords
        assert "正式" in prompt or "formal" in prompt.lower()
        assert "简洁" in prompt
        assert "结构化" in prompt or "结构" in prompt

    def test_includes_output_instruction(self):
        prompt = polish.build_polish_prompt("test")
        # Should instruct to return only the polished text
        assert "润色" in prompt or "polish" in prompt.lower()

    def test_handles_empty_summary(self):
        prompt = polish.build_polish_prompt("")
        assert len(prompt) > 0  # still produces a valid prompt


# ---------------------------------------------------------------------------
# S3: call_ai_api
# ---------------------------------------------------------------------------

class TestCallAiApi:
    """S3 — API call with retry logic (2 retries on network error)."""

    @pytest.fixture
    def config(self):
        return {
            "api_key": "sk-test",
            "endpoint": "https://api.deepseek.com",
            "model": "deepseek-chat",
        }

    def make_mock_response(self, content, status=200):
        """Helper to build a mock requests.Response."""
        mock = MagicMock()
        mock.status_code = status
        mock.json.return_value = {
            "choices": [{"message": {"content": content}}]
        }
        return mock

    def test_returns_polished_text_on_success(self, config):
        with patch("polish.requests.post") as mock_post:
            mock_post.return_value = self.make_mock_response("润色后的文本")

            result = polish.call_ai_api("原文", config)

            assert result == "润色后的文本"

    def test_sends_correct_payload(self, config):
        with patch("polish.requests.post") as mock_post:
            mock_post.return_value = self.make_mock_response("ok")

            polish.call_ai_api("测试原文", config)

            call_args = mock_post.call_args
            url = call_args[0][0]
            headers = call_args[1]["headers"]
            body = json.loads(call_args[1]["data"])

            assert url == "https://api.deepseek.com/v1/chat/completions"
            assert headers["Authorization"] == "Bearer sk-test"
            assert body["model"] == "deepseek-chat"
            assert body["messages"][0]["content"] == "测试原文"

    def test_retries_on_network_error(self, config):
        with patch("polish.requests.post") as mock_post:
            # First two calls raise network error, third succeeds
            mock_post.side_effect = [
                Exception("Connection reset"),
                Exception("Timeout"),
                self.make_mock_response("成功"),
            ]

            result = polish.call_ai_api("原文", config)

            assert result == "成功"
            assert mock_post.call_count == 3

    def test_raises_after_max_retries(self, config):
        with patch("polish.requests.post") as mock_post:
            mock_post.side_effect = Exception("Always fails")

            with pytest.raises(Exception, match="已重试"):
                polish.call_ai_api("原文", config)

            assert mock_post.call_count == 3  # 1 initial + 2 retries

    def test_retries_on_http_5xx(self, config):
        with patch("polish.requests.post") as mock_post:
            mock_post.side_effect = [
                self.make_mock_response("error", status=500),
                self.make_mock_response("error", status=503),
                self.make_mock_response("成功"),
            ]

            result = polish.call_ai_api("原文", config)

            assert result == "成功"
            assert mock_post.call_count == 3

    def test_does_not_retry_on_http_4xx(self, config):
        with patch("polish.requests.post") as mock_post:
            mock_post.return_value = self.make_mock_response("Bad request", status=400)

            with pytest.raises(Exception, match="AI API"):
                polish.call_ai_api("原文", config)

            assert mock_post.call_count == 1  # no retry on 4xx


# ---------------------------------------------------------------------------
# S4: apply_polish
# ---------------------------------------------------------------------------

class TestApplyPolish:
    """S4 — Write polished text back to the correct archive entry."""

    def test_updates_summary_and_flags_for_week(self, sample_data):
        item = {"type": "week", "key": "2026-W28"}

        polish.apply_polish(sample_data, item, "【润色后】本周完成人员调配3项。")

        entry = sample_data["archives"]["weeks"]["2026-W28"]
        assert entry["summary"] == "【润色后】本周完成人员调配3项。"
        assert entry["aiPolished"] is True

    def test_updates_summary_and_flags_for_month(self, sample_data):
        item = {"type": "month", "key": "2026-07"}

        polish.apply_polish(sample_data, item, "润色后月报")

        entry = sample_data["archives"]["months"]["2026-07"]
        assert entry["summary"] == "润色后月报"
        assert entry["aiPolished"] is True

    def test_updates_summary_and_flags_for_year(self, sample_data):
        item = {"type": "year", "key": "2026"}

        polish.apply_polish(sample_data, item, "润色后年报")

        entry = sample_data["archives"]["years"]["2026"]
        assert entry["summary"] == "润色后年报"
        assert entry["aiPolished"] is True

    def test_updates_lastModified(self, sample_data):
        item = {"type": "week", "key": "2026-W28"}
        old_modified = sample_data["lastModified"]

        polish.apply_polish(sample_data, item, "新内容")

        assert sample_data["lastModified"] != old_modified

    def test_does_not_mutate_other_entries(self, sample_data):
        item = {"type": "week", "key": "2026-W28"}
        original_w29_summary = sample_data["archives"]["weeks"]["2026-W29"]["summary"]

        polish.apply_polish(sample_data, item, "新内容")

        # W29 should be untouched
        assert sample_data["archives"]["weeks"]["2026-W29"]["summary"] == original_w29_summary


# ---------------------------------------------------------------------------
# S5: load_config
# ---------------------------------------------------------------------------

class TestLoadConfig:
    """S5 — Read .env file and return config dict."""

    def test_reads_all_fields(self):
        env_content = (
            "AI_API_KEY=sk-abc123\n"
            "AI_ENDPOINT=https://api.deepseek.com\n"
            "AI_MODEL=deepseek-chat\n"
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".env", delete=False, encoding="utf-8"
        ) as f:
            f.write(env_content)
            env_path = f.name

        try:
            config = polish.load_config(env_path)
            assert config["api_key"] == "sk-abc123"
            assert config["endpoint"] == "https://api.deepseek.com"
            assert config["model"] == "deepseek-chat"
        finally:
            os.unlink(env_path)

    def test_strips_quotes_and_whitespace(self):
        env_content = (
            'AI_API_KEY="sk-xyz"\n'
            "AI_ENDPOINT = https://dashscope.aliyuncs.com\n"
            "AI_MODEL=qwen-turbo\n"
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".env", delete=False, encoding="utf-8"
        ) as f:
            f.write(env_content)
            env_path = f.name

        try:
            config = polish.load_config(env_path)
            assert config["api_key"] == "sk-xyz"
            assert config["endpoint"] == "https://dashscope.aliyuncs.com"
            assert config["model"] == "qwen-turbo"
        finally:
            os.unlink(env_path)

    def test_raises_on_missing_api_key(self):
        env_content = "AI_ENDPOINT=https://api.deepseek.com\nAI_MODEL=deepseek-chat\n"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".env", delete=False, encoding="utf-8"
        ) as f:
            f.write(env_content)
            env_path = f.name

        try:
            with pytest.raises(ValueError, match="AI_API_KEY"):
                polish.load_config(env_path)
        finally:
            os.unlink(env_path)

    def test_raises_on_missing_file(self):
        with pytest.raises(FileNotFoundError):
            polish.load_config("/nonexistent/path/.env")


# ---------------------------------------------------------------------------
# S6: Roundtrip — JSON integrity
# ---------------------------------------------------------------------------

class TestRoundtrip:
    """S6 — Full data.json → process → write back, verify structure intact."""

    def test_full_roundtrip_preserves_structure(self, sample_data, tmp_path):
        # Write sample data to temp file
        data_file = tmp_path / "data.json"
        data_file.write_text(json.dumps(sample_data, ensure_ascii=False), encoding="utf-8")

        # Simulate the full processing flow without actual API calls
        data = polish.load_data(str(data_file))
        items = polish.find_unpolished(data)

        # Mock-polish each item
        for item in items:
            fake_polished = f"【润色】{item['summary']}"
            polish.apply_polish(data, item, fake_polished)

        # Write back
        polish.save_data(str(data_file), data)

        # Re-read and verify
        reloaded = json.loads(data_file.read_text(encoding="utf-8"))

        # All original top-level keys present
        for key in ["version", "lastModified", "settings", "projects", "tasks", "archives"]:
            assert key in reloaded

        # All archive keys preserved
        assert "2026-W28" in reloaded["archives"]["weeks"]
        assert "2026-W29" in reloaded["archives"]["weeks"]
        assert "2026-W30" in reloaded["archives"]["weeks"]
        assert "2026-07" in reloaded["archives"]["months"]
        assert "2026" in reloaded["archives"]["years"]

        # Polished entries are now aiPolished=True
        assert reloaded["archives"]["weeks"]["2026-W28"]["aiPolished"] is True
        assert reloaded["archives"]["months"]["2026-07"]["aiPolished"] is True
        assert reloaded["archives"]["years"]["2026"]["aiPolished"] is True

        # Already-polished entry unchanged
        assert reloaded["archives"]["weeks"]["2026-W29"]["aiPolished"] is True
        assert reloaded["archives"]["weeks"]["2026-W29"]["summary"] == "完成绩效数据整理，共处理15份考核表。"

        # Entry without summary unchanged
        assert reloaded["archives"]["weeks"]["2026-W30"]["aiPolished"] is False

        # lastModified updated
        assert reloaded["lastModified"] != sample_data["lastModified"]
