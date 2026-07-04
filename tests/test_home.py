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

def test_most_wanted_positioning(page):
    content = page.content()
    assert "Most Wanted #001" in content
    assert "防水不是加分项，是入场门槛" in content

def test_mz_daily_test_kit(page):
    content = page.content()
    for name in ["DJI Nano", "Insta360 GO3/GO3S", "拓竹", "Mac mini"]:
        assert name in content
