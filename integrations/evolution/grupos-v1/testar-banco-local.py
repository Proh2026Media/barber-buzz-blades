#!/usr/bin/env python3
"""Ensaia apenas a migration Evolution em PostgreSQL descartável local."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

if len(sys.argv) != 2:
    raise SystemExit("Uso: python3 testar-banco-local.py /caminho/do/checkout-evolution-com-patch")
checkout = Path(sys.argv[1]).resolve()
migration = checkout / "prisma/postgresql-migrations/20261111190000_bc_group_operations/migration.sql"
if not migration.is_file() or not (checkout / "test/bc-group-database.test.ts").is_file():
    raise SystemExit("Checkout sem o patch esperado")
docker = shutil.which("docker") or "/Applications/Docker.app/Contents/Resources/bin/docker"
name = "barba-evolution-grupos-test"
# Recusa Docker remoto, nome ocupado ou porta ocupada; nunca remove container preexistente.
context = subprocess.check_output([docker, "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], text=True).strip()
if os.environ.get("DOCKER_HOST") or not context.startswith("unix://"):
    raise SystemExit("Este ensaio exige Docker local por socket Unix")
if subprocess.run([docker, "container", "inspect", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
    raise SystemExit("Container de teste já existe; não será alterado")
owned_id = None
try:
    owned_id = subprocess.check_output([docker, "create", "--name", name,
        "-p", "127.0.0.1:54332:5432", "-e", "POSTGRES_PASSWORD=localtest",
        "supabase/postgres:15.8.1.085"], text=True).strip()
    subprocess.run([docker, "start", owned_id], check=True, stdout=subprocess.DEVNULL)
    for _ in range(60):
        if subprocess.run([docker, "exec", owned_id, "pg_isready", "-U", "postgres"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("PostgreSQL local não ficou pronto")
    subprocess.run([docker, "exec", "-i", owned_id, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
                   input=migration.read_bytes(), check=True)
    env = dict(os.environ, DATABASE_CONNECTION_URI="postgresql://postgres:localtest@127.0.0.1:54332/postgres",
               BC_GROUP_TEST_DATABASE="local-only")
    subprocess.run(["npm", "run", "test:bc-groups:db"], cwd=checkout, env=env, check=True)
finally:
    if owned_id:
        subprocess.run([docker, "rm", "-f", owned_id], check=True, stdout=subprocess.DEVNULL)
