import asyncio
import json
from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession

KAPRUKA_MCP_URL = "https://mcp.kapruka.com/mcp"

TOOLS_TO_FIND = [
    "kapruka_search_products",
    "kapruka_get_product",
    "kapruka_list_categories",
    "kapruka_list_delivery_cities",
    "kapruka_check_delivery",
    "kapruka_create_order",
    "kapruka_track_order",
]


async def extract_schemas():
    print("Connecting to Kapruka MCP server...")

    try:
        async with streamable_http_client(KAPRUKA_MCP_URL) as (
            read_stream,
            write_stream,
            _,
        ):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                response = await session.list_tools()

                tools_by_name = {tool.name: tool for tool in response.tools}

                for tool_name in TOOLS_TO_FIND:
                    print("\n" + "=" * 80)
                    print(f"TOOL: {tool_name}")

                    tool = tools_by_name.get(tool_name)

                    if not tool:
                        print("❌ Not found")
                        continue

                    print("✅ Found")
                    print("DESCRIPTION:")
                    print(tool.description)

                    print("\nINPUT SCHEMA:")
                    print(json.dumps(tool.inputSchema, indent=2))

    except Exception as e:
        print(f"Failed to fetch schemas: {e}")


if __name__ == "__main__":
    asyncio.run(extract_schemas())