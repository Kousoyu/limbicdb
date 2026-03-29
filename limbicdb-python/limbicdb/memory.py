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
        # Build command - use npm run for better compatibility
        cmd = ["npm", "run", command, "--"] + args + ["--json"]
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.limbicdb_path,
                capture_output=True,
                text=True,
                timeout=20  # 20 second timeout
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
                "selectedMemory": Memory object or None,
                "candidates": List[{
                    "memory": Memory object,
                    "score": float,
                    "reasons": List[str]
                }],
                "conflicts": bool,
                "decisionTrace": List[str]
            }
        """
        return self._run_cli("explain", [query])
    
    def remember(self, content: str) -> Dict[str, Any]:
        """
        Add memory to database
        
        Args:
            content: Memory content to store
            
        Returns:
            Dictionary with success status and content
        """
        return self._run_cli("remember", [content])
    
    def search(self, query: str) -> Dict[str, Any]:
        """
        Search memories by query
        
        Args:
            query: Search query
            
        Returns:
            Dictionary containing query and results list
        """
        return self._run_cli("search", [query])
    
    def timeline(self, query: str) -> Dict[str, Any]:
        """
        Get memory timeline for query
        
        Args:
            query: Query to filter timeline
            
        Returns:
            Dictionary containing query and memories list
        """
        return self._run_cli("timeline", [query])
    
    def forget(self, content: str) -> Dict[str, Any]:
        """
        Remove memory from database
        
        Args:
            content: Memory content to delete
            
        Returns:
            Dictionary with success status and deletion count
        """
        return self._run_cli("forget", [content])