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
    assert "One Platform. Multiple Modules." in content
    assert "一个平台，多种模块" in content

def test_founder_button(page):
    btn = page.locator(".founder-cta")
    assert btn.is_visible()
