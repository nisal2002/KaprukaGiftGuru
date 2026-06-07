import asyncio
import logging
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAPRUKA_MCP_URL = "https://mcp.kapruka.com/mcp"

async def async_execute_tool(tool_name: str, arguments: dict) -> dict:
    """Connects to Kapruka MCP, initializes, and runs the requested tool."""
    try:
        # 1. Establish the streamable HTTP connection
        async with streamable_http_client(KAPRUKA_MCP_URL) as (read, write, _):
            # 2. Open the protocol session
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # 3. Ensure arguments are properly nested inside 'params'
                payload = arguments if "params" in arguments else {"params": arguments}
                
                # 4. Call the tool and extract the text result
                result = await session.call_tool(tool_name, payload)
                
                if result.content and len(result.content) > 0:
                    return {"result": result.content[0].text}
                return {"error": "Tool returned no content."}
                
    except Exception as e:
        logger.error(f"MCP Tool Error: {str(e)}")
        return {"error": str(e)}

def execute_kapruka_tool(tool_name: str, arguments: dict) -> dict:
    """Synchronous execution wrapper for standard Flask routes."""
    return asyncio.run(async_execute_tool(tool_name, arguments))

# --- Quick Local Test ---
if __name__ == "__main__":
    print("Testing Simplified Kapruka MCP Connection...")
    test_args = {"q": "chocolate cake", "limit": 3}
    
    response = execute_kapruka_tool("kapruka_search_products", test_args)
    print("\n--- KAPRUKA RESPONSE ---")
    print(response.get("result", response.get("error")))