"""Test the MagSnap home page and key sections."""
import pytest

def test_title(page):
    assert "MAGSNAP" in page.title()

def test_hero_video(page):
    video = page.locator("#hero video")
    assert video.count() > 0

def test_system_section(page):
    section = page.locator("#system")
    assert section.is_visible()

def test_creators_rig_text(page):
    content = page.content()
    assert "Wearable Magnetic Ecosystem" in content

def test_chat_button(page):
    btn = page.locator("text=CHAT WITH MZ")
    assert btn.is_visible()
