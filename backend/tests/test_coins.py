"""Tests for coin balances, exchanges, donations and level calculation."""
import pytest
from django.urls import reverse

from apps.coins.models import (
    EXCHANGE_RATES,
    RARITY_BLUE,
    RARITY_GOLD,
    RARITY_GREEN,
    RARITY_PURPLE,
    RARITY_RED,
    CoinTransaction,
    HandshakeCoin,
)
from apps.coins.services import (
    InsufficientCoins,
    InvalidExchange,
    calculate_level,
    credit,
    debit,
    exchange,
    get_balance,
    level_progress,
    transfer,
)

pytestmark = pytest.mark.django_db


def give(user, rarity, amount):
    credit(user, rarity, amount, CoinTransaction.Type.ADMIN_GRANT, memo="test setup")


class TestEarningCoins:
    def test_new_user_has_zero_balances(self, user):
        assert HandshakeCoin.objects.filter(user=user).count() == 5
        assert get_balance(user, RARITY_GREEN) == 0

    def test_credit_increases_balance_and_logs_transaction(self, user):
        credit(user, RARITY_GREEN, 25, CoinTransaction.Type.ACTIVITY)
        assert get_balance(user, RARITY_GREEN) == 25
        assert CoinTransaction.objects.filter(
            to_user=user, transaction_type=CoinTransaction.Type.ACTIVITY
        ).count() == 1

    def test_debit_rejects_insufficient_balance(self, user):
        with pytest.raises(InsufficientCoins):
            debit(user, RARITY_GREEN, 5, CoinTransaction.Type.DONATION)

    def test_transfer_moves_coins_between_users(self, user, other_user):
        give(user, RARITY_GREEN, 30)
        transfer(user, other_user, RARITY_GREEN, 10, CoinTransaction.Type.DONATION)
        assert get_balance(user, RARITY_GREEN) == 20
        assert get_balance(other_user, RARITY_GREEN) == 10


class TestExchange:
    def test_green_to_blue_rate(self, user):
        give(user, RARITY_GREEN, EXCHANGE_RATES["blue"]["amount"])
        result = exchange(user, RARITY_BLUE)
        assert result["minted"] == 1
        assert result["burned"] == 50
        assert get_balance(user, RARITY_GREEN) == 0
        assert get_balance(user, RARITY_BLUE) == 1

    def test_blue_to_purple_rate(self, user):
        give(user, RARITY_BLUE, 10)
        exchange(user, RARITY_PURPLE)
        assert get_balance(user, RARITY_BLUE) == 0
        assert get_balance(user, RARITY_PURPLE) == 1

    def test_purple_to_red_and_red_to_gold(self, user):
        give(user, RARITY_PURPLE, 10)
        exchange(user, RARITY_RED)
        assert get_balance(user, RARITY_RED) == 1

        give(user, RARITY_RED, 9)
        exchange(user, RARITY_GOLD)
        assert get_balance(user, RARITY_GOLD) == 1
        assert get_balance(user, RARITY_RED) == 0

    def test_exchange_multiple_at_once(self, user):
        give(user, RARITY_GREEN, 150)
        result = exchange(user, RARITY_BLUE, count=3)
        assert result["minted"] == 3
        assert result["burned"] == 150
        assert get_balance(user, RARITY_BLUE) == 3

    def test_exchange_without_enough_coins_fails(self, user):
        give(user, RARITY_GREEN, 10)
        with pytest.raises(InsufficientCoins):
            exchange(user, RARITY_BLUE)
        assert get_balance(user, RARITY_GREEN) == 10

    def test_green_cannot_be_minted(self, user):
        with pytest.raises(InvalidExchange):
            exchange(user, RARITY_GREEN)

    def test_exchange_writes_burn_and_mint_transactions(self, user):
        give(user, RARITY_GREEN, 50)
        exchange(user, RARITY_BLUE)
        assert CoinTransaction.objects.filter(
            transaction_type=CoinTransaction.Type.EXCHANGE_BURN
        ).exists()
        assert CoinTransaction.objects.filter(
            transaction_type=CoinTransaction.Type.EXCHANGE_MINT
        ).exists()


class TestLevels:
    def test_default_level_is_green(self, user):
        assert calculate_level(user) == "green"

    def test_green_plus_threshold(self, user):
        give(user, RARITY_GREEN, 100)
        assert calculate_level(user) == "green_plus"

    def test_blue_and_blue_plus(self, user):
        give(user, RARITY_BLUE, 1)
        assert calculate_level(user) == "blue"
        give(user, RARITY_BLUE, 24)
        assert calculate_level(user) == "blue_plus"

    def test_gold_is_highest(self, user):
        give(user, RARITY_GOLD, 10)
        assert calculate_level(user) == "gold_plus"

    def test_level_progress_reports_next_target(self, user):
        give(user, RARITY_GREEN, 100)
        progress = level_progress(user)
        assert progress["level"] == "green_plus"
        assert progress["next_level"] == "blue"
        assert progress["needed"] == 1


class TestCoinApi:
    def test_balance_endpoint(self, auth_client):
        response = auth_client.get(reverse("v1:coins:balance"))
        assert response.status_code == 200
        assert response.data["level"] == "green"
        assert response.data["balances"]["green"] == 0

    def test_exchange_endpoint(self, auth_client):
        give(auth_client.user, RARITY_GREEN, 50)
        response = auth_client.post(
            reverse("v1:coins:exchange"), {"target_rarity": "blue", "count": 1}, format="json"
        )
        assert response.status_code == 200, response.data
        assert response.data["minted"] == 1

    def test_exchange_endpoint_rejects_insufficient(self, auth_client):
        response = auth_client.post(
            reverse("v1:coins:exchange"), {"target_rarity": "blue"}, format="json"
        )
        assert response.status_code == 400

    def test_donation_endpoint(self, auth_client, other_user):
        give(auth_client.user, RARITY_GREEN, 20)
        response = auth_client.post(
            reverse("v1:coins:donate"),
            {"recipient_username": other_user.username, "rarity": "green", "amount": 5},
            format="json",
        )
        assert response.status_code == 201, response.data
        assert get_balance(other_user, RARITY_GREEN) == 5

    def test_cannot_donate_to_self(self, auth_client):
        give(auth_client.user, RARITY_GREEN, 20)
        response = auth_client.post(
            reverse("v1:coins:donate"),
            {"recipient_username": auth_client.user.username, "rarity": "green", "amount": 5},
            format="json",
        )
        assert response.status_code == 400

    def test_transaction_history(self, auth_client):
        give(auth_client.user, RARITY_GREEN, 3)
        response = auth_client.get(reverse("v1:coins:transactions"))
        assert response.status_code == 200
        assert response.data["count"] >= 1

    def test_levels_reference_endpoint(self, auth_client):
        response = auth_client.get(reverse("v1:coins:levels"))
        assert response.status_code == 200
        assert response.data["exchange_rates"]["blue"]["amount"] == 50
