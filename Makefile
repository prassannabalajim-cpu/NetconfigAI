.PHONY: setup up down logs migrate seed test lint format build push shell-backend shell-db

setup:
	cp .env.example .env
	chmod +x scripts/*.sh

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	docker-compose exec backend alembic upgrade head

seed:
	docker-compose exec backend python scripts/seed_db.py

test:
	docker-compose exec backend pytest
	cd frontend && npm test

lint:
	docker-compose exec backend ruff check .
	cd frontend && npm run lint

format:
	docker-compose exec backend black .
	cd frontend && npm run format

build:
	docker-compose -f docker-compose.prod.yml build

push:
	docker-compose -f docker-compose.prod.yml push

shell-backend:
	docker-compose exec backend sh

shell-db:
	docker-compose exec postgres psql -U netconfig -d netconfig
