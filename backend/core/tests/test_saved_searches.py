import pytest
from core.models import SavedJobSearch

URL = "/api/v1/me/saved-searches/"


@pytest.mark.django_db
def test_create_and_list_saved_search(api_client, user):
    api_client.force_authenticate(user)
    response = api_client.post(
        URL,
        {
            "label": "Distans Python",
            "q": "python",
            "regions": ["CifL_Rzy_Mku"],
            "municipalities": [],
            "fields": [],
            "groups": [],
            "remote": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["label"] == "Distans Python"

    listed = api_client.get(URL).json()
    assert listed[0]["q"] == "python"
    assert listed[0]["remote"] is True


@pytest.mark.django_db
def test_cannot_see_other_users_saved_searches(api_client, user):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    stranger = User.objects.create_user(
        username="stranger", email="s@example.com", password="secret123"
    )
    SavedJobSearch.objects.create(owner=stranger, label="Other", q="secret")

    api_client.force_authenticate(user)
    labels = [row["label"] for row in api_client.get(URL).json()]
    assert "Other" not in labels


@pytest.mark.django_db
def test_delete_saved_search(api_client, user):
    saved = SavedJobSearch.objects.create(owner=user, label="Test", q="dev")
    api_client.force_authenticate(user)
    response = api_client.delete(f"{URL}{saved.id}/")
    assert response.status_code == 204
    assert not SavedJobSearch.objects.filter(pk=saved.id).exists()


def test_rename_saved_search(api_client, user):
    saved = SavedJobSearch.objects.create(owner=user, label="Old", q="dev")
    api_client.force_authenticate(user)
    response = api_client.patch(f"{URL}{saved.id}/", {"label": "Python distans"}, format="json")
    assert response.status_code == 200
    assert response.json()["label"] == "Python distans"
