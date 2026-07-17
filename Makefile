SHELL := /bin/bash
.DEFAULT_GOAL := help

REFERENCE_APP := apps/reference-viewer
PRODUCTION_APP := apps/viewer
WEB_APP := $(if $(wildcard $(PRODUCTION_APP)/package.json),$(PRODUCTION_APP),$(REFERENCE_APP))
WEB_LOCK := $(WEB_APP)/package-lock.json
WEB_DEPS := $(WEB_APP)/node_modules/.package-lock.json

.PHONY: help doctor setup clean clean-all install dev preview build check lint test \
	web-install web-dev web-preview web-build web-lint web-test \
	rust-prepare rust-check rust-build rust-wasm docs-check \
	db-status db-migrate deploy-preview deploy-production

help: ## Show the root command surface.
	@awk 'BEGIN {FS = ":.*## "; printf "Night Glow commands\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

doctor: ## Check required tools and report optional deployment/database tools.
	@./tools/doctor.sh

setup: doctor web-install rust-prepare rust-build db-status ## Prepare dependencies from a fresh checkout.

clean: ## Remove generated web, Rust, test, and deployment output.
	@./tools/clean.sh

clean-all: ## Also remove installed Node dependencies for a pristine checkout.
	@./tools/clean.sh all

install: setup ## Alias for setup.

dev: web-dev ## Launch the currently implemented website.

preview: web-preview ## Preview the most recent production web build.

build: web-build rust-build rust-wasm ## Build every currently implemented target.

check: docs-check web-lint web-build rust-check db-status ## Run non-browser repository validation.

lint: web-lint docs-check ## Check web source and documentation links.

test: web-test ## Run deterministic model checks; browser E2E remains explicit.

web-install: $(WEB_DEPS) ## Install the active website's locked Node dependencies.

$(WEB_DEPS): $(WEB_LOCK)
	@echo "Installing $(WEB_APP)"
	@npm --prefix "$(WEB_APP)" ci

web-dev: $(WEB_DEPS) ## Start the active website development server.
	@echo "Starting $(WEB_APP)"
	@npm --prefix "$(WEB_APP)" run dev -- --host 0.0.0.0

web-build: $(WEB_DEPS) ## Build the active website for production.
	@echo "Building $(WEB_APP)"
	@npm --prefix "$(WEB_APP)" run build

web-preview: $(WEB_DEPS) ## Serve the active website's production build locally.
	@npm --prefix "$(WEB_APP)" run preview -- --host 0.0.0.0

web-lint: $(WEB_DEPS) ## Lint the active website.
	@npm --prefix "$(WEB_APP)" run lint

web-test: $(WEB_DEPS) ## Run the deterministic reference model verification.
	@npm --prefix "$(WEB_APP)" run test:physics

docs-check: ## Verify every repository-local Markdown link.
	@node tools/check-links.mjs

rust-prepare: ## Install the standard browser Wasm target when rustup is available.
	@./tools/rust-workspaces.sh prepare

rust-check: ## Check every implemented Rust workspace.
	@./tools/rust-workspaces.sh check

rust-build: ## Compile every implemented native Rust workspace.
	@./tools/rust-workspaces.sh build

rust-wasm: ## Compile every implemented Rust Wasm binding.
	@./tools/rust-workspaces.sh wasm

db-status: ## Report the configured database adapter, if any.
	@./tools/database.sh status

db-migrate: ## Apply committed database migrations; currently a safe no-op.
	@./tools/database.sh migrate

deploy-preview: check ## Publish a Vercel preview deployment of the active website.
	@./tools/vercel.sh --cwd "$(WEB_APP)"

deploy-production: check ## Publish the active website to Vercel production.
	@./tools/vercel.sh --cwd "$(WEB_APP)" --prod
