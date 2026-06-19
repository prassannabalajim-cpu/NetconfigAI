"""
NetConfigAI — Backend Test Suite
Covers the happy path for all core API endpoints.
Run: pytest tests/ -v --tb=short
"""
import pytest
import uuid
import asyncio
from httpx import AsyncClient, ASGITransport

# ─── App import ───────────────────────────────────────────────────────────────
# Override DATABASE_URL before importing app to use test database
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_netconfig.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-minimum-32-chars!!"
os.environ["GEMINI_API_KEY"] = "test_key"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"

from app.main import app
from app.database import Base, engine


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    """Create all tables once before tests, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Cleanup test DB file
    if os.path.exists("test_netconfig.db"):
        os.remove("test_netconfig.db")


@pytest.fixture(scope="module")
async def client():
    """Async HTTP client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(scope="module")
async def auth_token(client):
    """Register a test user and return their JWT token."""
    # Register
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "testuser@netconfig.test",
        "password": "TestPass@123",
        "full_name": "Test User",
        "role": "network_engineer"
    })
    assert reg_resp.status_code in [200, 201, 400]  # 400 = already exists (idempotent)

    # Login
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "testuser@netconfig.test",
        "password": "TestPass@123"
    })
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


@pytest.fixture(scope="module")
async def admin_token(client):
    """Register an admin user and return their JWT token."""
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "admin@netconfig.test",
        "password": "AdminPass@123",
        "full_name": "Admin User",
        "role": "admin"
    })
    assert reg_resp.status_code in [200, 201, 400]

    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@netconfig.test",
        "password": "AdminPass@123"
    })
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


# ─── Auth Tests ───────────────────────────────────────────────────────────────

class TestAuth:
    """Tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """Happy path: register a new user."""
        resp = await client.post("/api/v1/auth/register", json={
            "email": f"new_{uuid.uuid4().hex[:8]}@test.com",
            "password": "SecurePass@123",
            "full_name": "New User",
            "role": "network_engineer"
        })
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "email" in data
        assert "id" in data
        assert "hashed_password" not in data  # Password must never be returned

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client):
        """Duplicate email must return 400."""
        email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
        await client.post("/api/v1/auth/register", json={
            "email": email, "password": "Pass@123", "full_name": "User 1"
        })
        resp = await client.post("/api/v1/auth/register", json={
            "email": email, "password": "Pass@123", "full_name": "User 2"
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_login_success(self, client, auth_token):
        """Happy path: login returns access_token."""
        assert auth_token is not None
        assert len(auth_token) > 20  # JWT is long

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """Wrong password must return 401."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "testuser@netconfig.test",
            "password": "WrongPassword!"
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Non-existent user must return 401."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "SomePass@123"
        })
        assert resp.status_code == 401


# ─── Review Tests ─────────────────────────────────────────────────────────────

class TestReviews:
    """Tests for review CRUD and workflow endpoints."""

    @pytest.mark.asyncio
    async def test_get_reviews_unauthenticated(self, client):
        """Reviews endpoint requires authentication."""
        resp = await client.get("/api/v1/reviews")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_reviews_authenticated(self, client, auth_token):
        """Happy path: authenticated user can list reviews."""
        resp = await client.get(
            "/api/v1/reviews",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_submit_review_json_config(self, client, auth_token):
        """Happy path: submit a review with JSON config files."""
        old_config = '{"firewall": {"rules": [{"port": 443, "source": "10.0.0.0/24"}]}}'
        new_config = '{"firewall": {"rules": [{"port": 443, "source": "0.0.0.0/0"}]}}'

        resp = await client.post(
            "/api/v1/reviews/submit",
            headers={"Authorization": f"Bearer {auth_token}"},
            data={
                "title": "Test Review - JSON Config",
                "config_type": "AWS Security Group",
                "cloud_provider": "aws",
                "compliance_frameworks": '["CIS", "NIST"]'
            },
            files={
                "old_config": ("old.json", old_config.encode(), "application/json"),
                "new_config": ("new.json", new_config.encode(), "application/json"),
            }
        )
        assert resp.status_code in [200, 201, 202]
        data = resp.json()
        assert "id" in data
        assert "status" in data
        return data["id"]

    @pytest.mark.asyncio
    async def test_get_review_by_id(self, client, auth_token):
        """Happy path: get a specific review by ID."""
        # First get the list
        list_resp = await client.get(
            "/api/v1/reviews",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if not reviews:
            pytest.skip("No reviews in DB to test")

        review_id = reviews[0]["id"]
        resp = await client.get(
            f"/api/v1/reviews/{review_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == review_id
        assert "status" in data
        assert "title" in data

    @pytest.mark.asyncio
    async def test_get_review_status(self, client, auth_token):
        """Happy path: get review status endpoint."""
        list_resp = await client.get(
            "/api/v1/reviews",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if not reviews:
            pytest.skip("No reviews in DB to test")

        review_id = reviews[0]["id"]
        resp = await client.get(
            f"/api/v1/reviews/{review_id}/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "review_id" in data

    @pytest.mark.asyncio
    async def test_approve_review(self, client, auth_token):
        """Happy path: approve a review with a comment."""
        list_resp = await client.get(
            "/api/v1/reviews",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if not reviews:
            pytest.skip("No reviews available to approve")

        review_id = reviews[0]["id"]
        resp = await client.patch(
            f"/api/v1/reviews/{review_id}/approve",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"comment": "Reviewed and approved — all changes are acceptable."}
        )
        assert resp.status_code == 200
        workflow_steps = resp.json()
        assert isinstance(workflow_steps, list)
        # Find the APPROVED step
        statuses = [s["status"] for s in workflow_steps]
        assert "APPROVED" in statuses

    @pytest.mark.asyncio
    async def test_reject_review(self, client, auth_token):
        """Happy path: reject a review with a mandatory comment."""
        list_resp = await client.get(
            "/api/v1/reviews?page=1&size=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if len(reviews) < 2:
            pytest.skip("Need at least 2 reviews to test reject")

        review_id = reviews[1]["id"]
        resp = await client.patch(
            f"/api/v1/reviews/{review_id}/reject",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"comment": "Rejected — SSH port 22 opened to 0.0.0.0/0 is a critical violation."}
        )
        assert resp.status_code == 200
        steps = resp.json()
        statuses = [s["status"] for s in steps]
        assert "REJECTED" in statuses

    @pytest.mark.asyncio
    async def test_escalate_review(self, client, auth_token):
        """Happy path: escalate a review for senior review."""
        list_resp = await client.get(
            "/api/v1/reviews?page=1&size=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if not reviews:
            pytest.skip("No reviews to escalate")

        review_id = reviews[0]["id"]
        resp = await client.patch(
            f"/api/v1/reviews/{review_id}/escalate",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"comment": "Escalating — requires CISO approval due to CRITICAL risk score."}
        )
        assert resp.status_code == 200
        steps = resp.json()
        statuses = [s["status"] for s in steps]
        assert "ESCALATED" in statuses

    @pytest.mark.asyncio
    async def test_get_workflow_steps(self, client, auth_token):
        """Happy path: get workflow steps for a review."""
        list_resp = await client.get(
            "/api/v1/reviews",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        reviews = list_resp.json()
        if not reviews:
            pytest.skip("No reviews to get workflow for")

        review_id = reviews[0]["id"]
        resp = await client.get(
            f"/api/v1/reviews/{review_id}/workflow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_get_nonexistent_review(self, client, auth_token):
        """Non-existent review must return 404."""
        fake_id = str(uuid.uuid4())
        resp = await client.get(
            f"/api/v1/reviews/{fake_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 404


# ─── Dashboard Tests ──────────────────────────────────────────────────────────

class TestDashboard:
    """Tests for dashboard statistics endpoint."""

    @pytest.mark.asyncio
    async def test_dashboard_authenticated(self, client, auth_token):
        """Happy path: dashboard returns stats for authenticated user."""
        resp = await client.get(
            "/api/v1/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        # Verify expected fields
        assert "total_reviews" in data
        assert "open_reviews" in data
        assert "pending_approvals" in data
        assert isinstance(data["total_reviews"], int)
        assert isinstance(data["open_reviews"], int)

    @pytest.mark.asyncio
    async def test_dashboard_unauthenticated(self, client):
        """Dashboard requires authentication."""
        resp = await client.get("/api/v1/dashboard")
        assert resp.status_code == 401


# ─── Audit Log Tests ──────────────────────────────────────────────────────────

class TestAuditLog:
    """Tests for audit trail endpoint."""

    @pytest.mark.asyncio
    async def test_audit_log_authenticated(self, client, auth_token):
        """Happy path: audit log returns event list."""
        resp = await client.get(
            "/api/v1/audit",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_audit_log_unauthenticated(self, client):
        """Audit log requires authentication."""
        resp = await client.get("/api/v1/audit")
        assert resp.status_code == 401


# ─── Health Check Tests ───────────────────────────────────────────────────────

class TestHealth:
    """Tests for health check endpoints."""

    @pytest.mark.asyncio
    async def test_health_ready(self, client):
        """Health ready endpoint returns 200."""
        resp = await client.get("/health/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"

    @pytest.mark.asyncio
    async def test_health_live(self, client):
        """Health live endpoint returns 200."""
        resp = await client.get("/health/live")
        assert resp.status_code == 200


# ─── Diff Engine Unit Tests ───────────────────────────────────────────────────

class TestDiffEngine:
    """Unit tests for the diff engine service."""

    def test_json_diff_detects_cidr_change(self):
        """Diff engine detects CIDR expansion as HIGH risk."""
        from app.services.diff_engine import DiffEngine
        engine = DiffEngine()

        old = {"rules": [{"source": "10.0.0.0/24", "port": 443}]}
        new = {"rules": [{"source": "10.0.0.0/8", "port": 443}]}

        changes = engine.compute_diff(
            old_config=old, new_config=new, config_type="json"
        )
        assert len(changes) > 0
        risk_levels = [c.get("risk_level", "LOW") for c in changes]
        assert any(r in ["HIGH", "CRITICAL"] for r in risk_levels)

    def test_json_diff_detects_ssh_exposure(self):
        """Diff engine flags port 22 opened to 0.0.0.0/0 as CRITICAL."""
        from app.services.diff_engine import DiffEngine
        engine = DiffEngine()

        old = {"rules": [{"port": 22, "source": "10.0.1.0/24"}]}
        new = {"rules": [{"port": 22, "source": "0.0.0.0/0"}]}

        changes = engine.compute_diff(old, new, "json")
        scores = [c.get("risk_score", 0) for c in changes]
        assert any(s >= 70 for s in scores)

    def test_text_diff_works_for_cisco_config(self):
        """Diff engine handles plain-text Cisco IOS format."""
        from app.services.diff_engine import DiffEngine
        engine = DiffEngine()

        old = "service password-encryption\nlogging host 10.0.0.1\n"
        new = "no service password-encryption\nno logging host\n"

        changes = engine.compute_diff(old, new, "text")
        assert len(changes) > 0

    def test_identical_configs_return_no_changes(self):
        """Identical configs produce zero diff changes."""
        from app.services.diff_engine import DiffEngine
        engine = DiffEngine()

        config = {"key": "value", "port": 443}
        changes = engine.compute_diff(config, config, "json")
        assert len(changes) == 0
