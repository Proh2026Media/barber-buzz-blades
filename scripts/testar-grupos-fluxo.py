#!/usr/bin/env python3
"""Ensaio integrado em container exclusivo; nunca usa .env ou rede de produção."""
import os
from pathlib import Path
import shutil
import subprocess
ROOT = Path(__file__).resolve().parents[1]
DOCKER = shutil.which("docker") or "/Applications/Docker.app/Contents/Resources/bin/docker"
NAME = "barba-grupos-fluxo"
endpoint = subprocess.check_output([DOCKER,"context","inspect","--format","{{.Endpoints.docker.Host}}"],text=True).strip()
if os.environ.get("DOCKER_HOST") or not endpoint.startswith("unix://"):
    raise SystemExit("Exige Docker local por socket Unix")
if subprocess.run([DOCKER,"inspect",NAME],capture_output=True).returncode == 0:
    raise SystemExit("Container já existe e não será alterado")
env = dict(os.environ,BC_BANCO_LOCAL_NOME=NAME,BC_BANCO_LOCAL_PORTA="54334",BC_GROUP_LOCAL_FLOW=NAME,
           BC_TEST_DOCKER=DOCKER,PATH=str(Path(DOCKER).parent)+os.pathsep+os.environ.get("PATH",""))
try:
    subprocess.run([str(ROOT/"scripts/banco-local.sh"),"subir","20261110190000"],env=env,check=True,timeout=120)
    subprocess.run(["node",str(ROOT/"scripts/testar-grupos-fluxo.ts")],env=env,cwd=ROOT,check=True,timeout=120)
finally:
    subprocess.run([DOCKER,"rm","-f",NAME],capture_output=True)
