#!/usr/bin/env python3
"""
Basic usage example for LimbicDB Python SDK
"""

import os
import sys

# Add the parent directory to Python path for development
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from limbicdb import Memory

def main():
    """Basic usage example"""
    print("=== LimbicDB Python SDK - Basic Usage ===\n")
    
    # Initialize memory
    # Note: You need to set LIMBICDB_PATH environment variable
    # or provide the path to your LimbicDB installation
    limbicdb_path = os.environ.get('LIMBICDB_PATH', '/tmp/limbicdb')
    
    try:
        memory = Memory(limbicdb_path=limbicdb_path)
        print(f"✓ Connected to LimbicDB at: {limbicdb_path}")
    except Exception as e:
        print(f"✗ Failed to connect to LimbicDB: {e}")
        print("Make sure you have:")
        print("1. Cloned https://github.com/Kousoyu/limbicdb")
        print("2. Run 'npm install' in the LimbicDB directory")
        print("3. Set LIMBICDB_PATH environment variable (optional)")
        return
    
    # Explain memory retrieval
    print("\n🔍 Explaining memory retrieval for 'anime':")
    try:
        explanation = memory.explain("anime")
        print(f"Query: {explanation.get('query', 'N/A')}")
        print(f"Conflicts: {explanation.get('conflicts', False)}")
        
        candidates = explanation.get('candidates', [])
        print(f"Candidates found: {len(candidates)}")
        
        for i, candidate in enumerate(candidates[:2], 1):
            memory_obj = candidate.get('memory', {})
            print(f"  {i}. Content: {memory_obj.get('content', 'N/A')}")
            print(f"     Score: {candidate.get('score', 0):.3f}")
            print(f"     Reasons: {', '.join(candidate.get('reasons', []))}")
        
        print("\nDecision trace:")
        for step in explanation.get('decisionTrace', []):
            print(f"  • {step}")
            
    except Exception as e:
        print(f"✗ Error explaining memory: {e}")

if __name__ == "__main__":
    main()