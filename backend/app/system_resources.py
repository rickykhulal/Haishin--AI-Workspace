"""
Lightweight Windows system and hardware resource monitor for Haishin v0.4.
Collects CPU, RAM, and GPU/VRAM usage without heavyweight background daemons.
Distinguishes unavailable metrics from zero usage.
"""

import subprocess
import shutil
from typing import Optional, Dict, Any

try:
    import psutil
except ImportError:
    psutil = None


def get_gpu_info() -> Dict[str, Any]:
    """
    Query NVIDIA GPU stats via nvidia-smi with bounded timeout.
    Returns structured data or marks GPU as unavailable with precise diagnostics.
    Never reports 0 for unavailable GPU metrics.
    """
    nvidia_smi_path = shutil.which("nvidia-smi")
    if not nvidia_smi_path:
        return {
            "gpu_available": False,
            "gpu_name": None,
            "vram_total_mb": None,
            "vram_used_mb": None,
            "vram_free_mb": None,
            "gpu_utilization_percent": None,
            "details": "nvidia-smi utility was not found in system PATH.",
        }

    cmd = [
        nvidia_smi_path,
        "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu",
        "--format=csv,noheader,nounits",
    ]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=1.5,
            check=False,
        )
        if proc.returncode != 0:
            return {
                "gpu_available": False,
                "gpu_name": None,
                "vram_total_mb": None,
                "vram_used_mb": None,
                "vram_free_mb": None,
                "gpu_utilization_percent": None,
                "details": f"nvidia-smi returned exit code {proc.returncode}: {proc.stderr.strip()}",
            }

        lines = [line.strip() for line in proc.stdout.strip().splitlines() if line.strip()]
        if not lines:
            return {
                "gpu_available": False,
                "gpu_name": None,
                "vram_total_mb": None,
                "vram_used_mb": None,
                "vram_free_mb": None,
                "gpu_utilization_percent": None,
                "details": "nvidia-smi returned empty output.",
            }

        parts = [p.strip() for p in lines[0].split(",")]
        if len(parts) >= 5:
            gpu_name = parts[0]
            total_mb = float(parts[1])
            used_mb = float(parts[2])
            free_mb = float(parts[3])
            util_percent = float(parts[4])

            return {
                "gpu_available": True,
                "gpu_name": gpu_name,
                "vram_total_mb": total_mb,
                "vram_used_mb": used_mb,
                "vram_free_mb": free_mb,
                "gpu_utilization_percent": util_percent,
                "details": f"{gpu_name} ({int(used_mb)}/{int(total_mb)} MiB VRAM used)",
            }
        else:
            return {
                "gpu_available": False,
                "gpu_name": None,
                "vram_total_mb": None,
                "vram_used_mb": None,
                "vram_free_mb": None,
                "gpu_utilization_percent": None,
                "details": f"Unexpected nvidia-smi format: '{lines[0]}'",
            }

    except subprocess.TimeoutExpired:
        return {
            "gpu_available": False,
            "gpu_name": None,
            "vram_total_mb": None,
            "vram_used_mb": None,
            "vram_free_mb": None,
            "gpu_utilization_percent": None,
            "details": "nvidia-smi query timed out after 1.5 seconds.",
        }
    except Exception as exc:
        return {
            "gpu_available": False,
            "gpu_name": None,
            "vram_total_mb": None,
            "vram_used_mb": None,
            "vram_free_mb": None,
            "gpu_utilization_percent": None,
            "details": f"Failed to execute nvidia-smi: {str(exc)}",
        }


def get_system_resources() -> Dict[str, Any]:
    """
    Collect current CPU, RAM, and GPU/VRAM stats.
    """
    if psutil is not None:
        cpu_pct = float(psutil.cpu_percent(interval=None))
        mem = psutil.virtual_memory()
        total_mb = round(mem.total / (1024 * 1024), 1)
        used_mb = round(mem.used / (1024 * 1024), 1)
        ram_pct = float(mem.percent)
    else:
        cpu_pct = -1.0
        total_mb = -1.0
        used_mb = -1.0
        ram_pct = -1.0

    gpu_info = get_gpu_info()

    return {
        "cpu_percent": cpu_pct,
        "ram_total_mb": total_mb,
        "ram_used_mb": used_mb,
        "ram_percent": ram_pct,
        "gpu_available": gpu_info["gpu_available"],
        "gpu_name": gpu_info["gpu_name"],
        "vram_total_mb": gpu_info["vram_total_mb"],
        "vram_used_mb": gpu_info["vram_used_mb"],
        "vram_free_mb": gpu_info["vram_free_mb"],
        "gpu_utilization_percent": gpu_info["gpu_utilization_percent"],
        "details": gpu_info["details"],
    }
