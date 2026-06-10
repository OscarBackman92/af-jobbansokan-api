import pytest

pytestmark = pytest.mark.django_db


def test_admin_index_loads(admin_client):
    response = admin_client.get("/admin/")
    assert response.status_code == 200


def test_admin_auditlog_list_loads(admin_client):
    response = admin_client.get("/admin/core/auditlog/")
    assert response.status_code == 200


def test_admin_login_page_loads(client):
    response = client.get("/admin/login/")
    assert response.status_code == 200
