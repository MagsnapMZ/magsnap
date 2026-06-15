"""Test the Ecosystem section with product grid."""
import pytest

def test_ecosystem_section(page):
    section = page.locator("#snap")
    assert section.is_visible()

def test_ecosystem_header(page):
    content = page.content()
    assert "MAGSNAP Ecosystem" in content
    assert "磁吸生态" in content

def test_device_cards(page):
    cards = page.locator(".eco-item")
    count = cards.count()
    assert count == 6, f"Expected 6 ecosystem category cards, got {count}"

def test_category_names(page):
    content = page.content()
    for name in ["Camera", "Audio", "Communication", "Tracking", "Lighting", "AI Coming Soon"]:
        assert name in content, f"Missing category: {name}"

def test_chinese_category_names(page):
    content = page.content()
    for name in ["相机", "音频", "通讯", "定位", "照明", "AI 即将推出"]:
        assert name in content, f"Missing Chinese category: {name}"

def test_removed_long_lab_section(page):
    assert page.locator("#lab").count() == 0
    assert "MAGSNAP LAB" not in page.content()
