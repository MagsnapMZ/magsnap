"""Test the Ecosystem section with product grid."""
import pytest

def test_ecosystem_section(page):
    section = page.locator("#snap")
    assert section.is_visible()

def test_ecosystem_header(page):
    content = page.content()
    assert "Compact Magnetic Index" in content
    assert "问题队列" in content

def test_device_cards(page):
    cards = page.locator(".eco-item")
    count = cards.count()
    assert count >= 7, f"Expected >=7 device cards, got {count}"

def test_device_names(page):
    content = page.content()
    for name in ["GO3", "DJI Nano", "DJI Mic", "AirTag"]:
        assert name in content, f"Missing device: {name}"

def test_accessory_names(page):
    content = page.content()
    for name in ["MagSnap Frame", "MagDock", "ZenLoop", "MagWipe"]:
        assert name in content, f"Missing accessory: {name}"

def test_lab_section(page):
    lab = page.locator("#lab")
    assert lab.is_visible()
