SHELL := /bin/bash
.DEFAULT_GOAL := help

REFERENCE_APP := apps/reference-viewer
PRODUCTION_APP := apps/viewer
VIEWER_PROOF := apps/viewer/experiments/runtime
WEB_APP := $(if $(wildcard $(PRODUCTION_APP)/package.json),$(PRODUCTION_APP),$(REFERENCE_APP))
WEB_LOCK := $(WEB_APP)/package-lock.json
WEB_DEPS := $(WEB_APP)/node_modules/.package-lock.json
VIEWER_PROOF_LOCK := $(VIEWER_PROOF)/package-lock.json
VIEWER_PROOF_DEPS := $(VIEWER_PROOF)/node_modules/.package-lock.json

.PHONY: help doctor setup clean clean-all install dev preview build check lint test \
	web-install web-dev web-preview web-build web-lint web-test \
	viewer-proof-install viewer-proof-build viewer-proof-lint viewer-proof-test \
	rust-prepare rust-format-check rust-check rust-test rust-build rust-wasm native-probe wasm-probe coordinator-test docs-check contract-check reproducibility-check non-ui-check \
	db-status db-migrate deploy-preview deploy-production

help: ## Show the root command surface.
	@awk 'BEGIN {FS = ":.*## "; printf "Night Glow commands\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

doctor: ## Check required tools and report optional deployment/database tools.
	@./tools/doctor.sh

setup: doctor web-install viewer-proof-install rust-prepare rust-build db-status ## Prepare dependencies from a fresh checkout.

clean: ## Remove generated web, Rust, test, and deployment output.
	@./tools/clean.sh

clean-all: ## Also remove installed Node dependencies for a pristine checkout.
	@./tools/clean.sh all

install: setup ## Alias for setup.

dev: web-dev ## Launch the currently implemented website.

preview: web-preview ## Preview the most recent production web build.

build: web-build viewer-proof-build rust-build rust-wasm ## Build every currently implemented target.

check: docs-check contract-check reproducibility-check web-lint web-build viewer-proof-lint viewer-proof-build rust-format-check rust-check coordinator-test db-status ## Run non-browser repository validation.

lint: web-lint docs-check ## Check web source and documentation links.

test: contract-check web-test rust-test native-probe wasm-probe coordinator-test viewer-proof-test ## Run deterministic model, parity, and bounded browser checks.

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
	@npm --prefix "$(REFERENCE_APP)" run test:astronomy

viewer-proof-install: $(VIEWER_PROOF_DEPS) ## Install locked dependencies for the M1 Viewer runtime proof.

$(VIEWER_PROOF_DEPS): $(VIEWER_PROOF_LOCK)
	@echo "Installing $(VIEWER_PROOF)"
	@npm --prefix "$(VIEWER_PROOF)" ci

viewer-proof-build: $(VIEWER_PROOF_DEPS) ## Build the bounded Next.js Viewer runtime proof.
	@npm --prefix "$(VIEWER_PROOF)" run build

viewer-proof-lint: $(VIEWER_PROOF_DEPS) ## Lint the bounded Next.js Viewer runtime proof.
	@npm --prefix "$(VIEWER_PROOF)" run lint

viewer-proof-test: viewer-proof-build $(WEB_DEPS) ## Browser-check the route, MapLibre, WebGL2, and bundle boundaries.
	@npm --prefix "$(REFERENCE_APP)" run test:m1-browser
	@npm --prefix "$(REFERENCE_APP)" run test:m1-runtime

docs-check: ## Verify every repository-local Markdown link.
	@node tools/check-links.mjs

contract-check: ## Validate the language-neutral cross-package conformance fixtures.
	@node tools/check-contract-fixtures.mjs

reproducibility-check: ## Verify pinned non-UI build inputs, assets, and licence declarations.
	@node tools/check-reproducibility.mjs

non-ui-check: docs-check contract-check reproducibility-check rust-format-check rust-check rust-test native-probe wasm-probe coordinator-test ## Run the complete non-UI CI surface.

rust-prepare: ## Install the standard browser Wasm target when rustup is available.
	@./tools/rust-workspaces.sh prepare

rust-check: ## Check every implemented Rust workspace.
	@./tools/rust-workspaces.sh check

rust-format-check: ## Verify formatting in every implemented Rust workspace.
	@./tools/rust-workspaces.sh fmt

rust-test: ## Test every implemented Rust workspace.
	@./tools/rust-workspaces.sh test

rust-build: ## Compile every implemented native Rust workspace.
	@./tools/rust-workspaces.sh build

rust-wasm: ## Compile every implemented Rust Wasm binding.
	@./tools/rust-workspaces.sh wasm

native-probe: ## Run the bounded native Environment and Physics conformance probes.
	@cargo run --release --manifest-path packages/environment/Cargo.toml -p environment-precompute -- fixture-report
	@cargo run --release --manifest-path packages/environment/Cargo.toml -p environment-conformance
	@cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-precompute -- fixture-report
	@cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-validation

wasm-probe: rust-wasm ## Measure the first native/Wasm parity and memory boundary.
	@node tools/probe-wasm.mjs

coordinator-test: rust-wasm ## Exercise lifecycle, cancellation, transfer, and memory against both Wasm modules.
	@npm --prefix runtime/browser-worker test

db-status: ## Report the configured database adapter, if any.
	@./tools/database.sh status

db-migrate: ## Apply committed database migrations; currently a safe no-op.
	@./tools/database.sh migrate

deploy-preview: check ## Publish a Vercel preview deployment of the active website.
	@./tools/vercel.sh --cwd "$(WEB_APP)"

deploy-production: check ## Publish the active website to Vercel production.
	@./tools/vercel.sh --cwd "$(WEB_APP)" --prod
