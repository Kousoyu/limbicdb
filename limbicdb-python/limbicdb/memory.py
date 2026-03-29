"""
LimbicDB Memory Class
Thin wrapper around LimbicDB CLI commands
"""

import subprocess
import json
import os
from typing import List, Dict, Any, Optional

class MemoryError(Exception):
    """Base exception for LimbicDB errors"""
    pass

class Memory:
    """
    LimbicDB Memory interface for Python
    
    This class provides a thin wrapper around the LimbicDB CLI,
    allowing Python applications to use LimbicDB's debuggable memory features.
    """
    
    def __init__(self, path: str = ".limbic", limbicdb_path: Optional[str] = None):
        """
        Initialize LimbicDB Memory
        
        Args:
            path: Path to the .limbic database file
            limbicdb_path: Path to the LimbicDB installation directory
                          If not provided, will look for LIMBICDB_PATH env var
                          or default to current working directory
        """
        self.path = path
        self.limbicdb_path = limbicdb_path or os.environ.get('LIMBICDB_PATH', '.')
        
        # Verify LimbicDB is available
        if not self._check_limbicdb_available():
            raise MemoryError(f"LimbicDB not found at {self.limbicdb_path}")
    
    def _check_limbicdb_available(self) -> bool:
        """Check if LimbicDB CLI is available"""
        try:
            result = subprocess.run(
                ["npm", "list", "--depth=0"],
                cwd=self.limbicdb_path,
                capture_output=True,
                text=True
            )
            return "limbicdb" in result.stdout
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    
    def _run_cli(self, command: str, args: List[str]) -> Dict[str, Any]:
        """
        Execute LimbicDB CLI command and return JSON result
        
        Args:
            command: CLI command name (e.g., "explain")
            args: Command arguments
            
        Returns:
            Parsed JSON output from CLI
            
        Raises:
            MemoryError: If CLI command fails
        """
        # Build command
        cmd = ["npm", "run", command, "--"] + args + ["--json"]
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.limbicdb_path,
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout
                raise MemoryError(f"CLI command failed: {error_msg}")
            
            # Parse JSON output
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                # If no JSON output, return empty dict
                return {}
                
        except subprocess.TimeoutExpired:
            raise MemoryError("CLI command timed out")
        except Exception as e:
            raise MemoryError(f"CLI execution error: {str(e)}")
    
    def explain(self, query: str) -> Dict[str, Any]:
        """
        Explain memory retrieval decisions
        
        Args:
            query: Search query to explain
            
        Returns:
            Dictionary containing explanation with structure:
            {
                "query": str,
                "candidates": List[{
                    "memory": {"content": str, "strength": float, ...},
                    "score": float,
                    "reasons": List[str]
                }],
                "conflicts": bool,
                "decisionTrace": List[str]
            }
        """
        return self._run_cli("explain", [query])
    
    def add(self, content: str, type: str = "fact", strength: float = 1.0, 
            metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Add memory to database
        
        Note: This is a placeholder. Actual implementation would require
        a 'remember' CLI command to be added to LimbicDB.
        """
        raise NotImplementedError("Add functionality requires 'remember' CLI command")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search memories by query
        
        Note: This is a placeholder. Actual implementation would require
        a 'search' CLI command to be added to LimbicDB.
        """
        raise NotImplementedError("Search functionality requires 'search' CLI command")
    
    def timeline(self, query: str) -> List[Dict[str, Any]]:
        """
        Get memory timeline for query
        
        Note: This is a placeholder. Actual implementation would require
        a 'timeline' CLI command to be added to LimbicDB.
        """
        raise NotImplementedError("Timeline functionality requires 'timeline' CLI command")
    
    def forget(self, content: str) -> bool:
        """
        Remove memory from database
        
        Note: This is a placeholder. Actual implementation would require
        a 'forget' CLI command to be added to LimbicDB.
        """
        raise NotImplementedError("Forget functionality requires 'forget' CLI command")