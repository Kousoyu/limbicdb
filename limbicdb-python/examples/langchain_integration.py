#!/usr/bin/env python3
"""
LangChain integration example for LimbicDB Python SDK
"""

import os
import sys

# Add the parent directory to Python path for development
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from limbicdb import Memory

class LimbicMemory:
    """
    LangChain-compatible memory interface for LimbicDB
    
    This is a minimal implementation to demonstrate integration.
    A full implementation would need to handle all LangChain memory methods.
    """
    
    def __init__(self, limbicdb_path=None):
        self.db = Memory(limbicdb_path=limbicdb_path)
        self.memory_variables = ["history"]
    
    def load_memory_variables(self, inputs):
        """Load memory variables for LangChain"""
        query = inputs.get("input", "")
        try:
            # Use LimbicDB search (placeholder - needs actual search CLI)
            # For now, we'll just return empty history
            return {"history": ""}
        except Exception as e:
            print(f"Warning: Could not load memory: {e}")
            return {"history": ""}
    
    def save_context(self, inputs, outputs):
        """Save context to LimbicDB memory"""
        text = inputs.get("input", "") + " " + outputs.get("output", "")
        # Note: This requires 'remember' CLI command to be implemented
        print(f"Would save to memory: {text}")

def main():
    """LangChain integration example"""
    print("=== LimbicDB Python SDK - LangChain Integration ===\n")
    
    # Initialize LimbicDB memory
    limbicdb_path = os.environ.get('LIMBICDB_PATH', '/tmp/limbicdb')
    
    try:
        limbic_memory = LimbicMemory(limbicdb_path=limbicdb_path)
        print("✓ Created LimbicDB memory for LangChain")
    except Exception as e:
        print(f"✗ Failed to create LimbicDB memory: {e}")
        return
    
    # Simulate LangChain agent interaction
    print("\n🤖 Simulating LangChain agent interaction:")
    
    # Agent receives input
    user_input = "What do I like?"
    print(f"User: {user_input}")
    
    # Load memory context
    context = limbic_memory.load_memory_variables({"input": user_input})
    print(f"Memory context loaded: {context['history'] or '(empty)'}")
    
    # Agent generates response (simulated)
    agent_response = "You like anime!"
    print(f"Agent: {agent_response}")
    
    # Save context to memory
    limbic_memory.save_context(
        {"input": user_input}, 
        {"output": agent_response}
    )
    
    # Explain the decision (this is where LimbicDB shines!)
    print("\n🔍 Explaining the agent's decision:")
    try:
        explanation = limbic_memory.db.explain(user_input)
        if explanation.get('conflicts'):
            print("⚠️  Conflicting memories detected in the agent's knowledge!")
            print("This explains why the agent might give inconsistent answers.")
        else:
            print("✅ No conflicts detected in memory.")
    except Exception as e:
        print(f"Could not explain decision: {e}")
    
    print("\n💡 This demonstrates how LimbicDB provides debuggable memory")
    print("for AI agents, making their decisions transparent and explainable.")

if __name__ == "__main__":
    main()