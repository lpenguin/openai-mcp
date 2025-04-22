#!/usr/bin/env node
import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import { Readable, Writable } from 'stream';

// Start the MCP server process
const serverProcess: ChildProcess = spawn('node', ['dist/mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Create interface to read from stdout
const rl: Interface = createInterface({
  input: serverProcess.stdout as Readable,
  crlfDelay: Infinity
});

// Listen for server output
rl.on('line', (line: string) => {
  try {
    // Parse JSON responses from the server
    const response = JSON.parse(line);
    console.log('\nServer response:');
    console.log(JSON.stringify(response, null, 2));
    
    // If this is a response to the list tools request, send a generate image request
    if (response.result && response.result.tools) {
      console.log('\nSending generate_image request...');
      sendGenerateImageRequest();
    }
  } catch (error) {
    // Handle non-JSON output (like server startup messages)
    console.log(`Server output: ${line}`);
  }
});

// Function to send a request to list available tools
function sendListToolsRequest(): void {
  const request = {
    jsonrpc: '2.0',
    id: '1',
    method: 'tools/list',
    params: {}
  };
  
  console.log('\nSending tools/list request:');
  console.log(JSON.stringify(request, null, 2));
  
  // Ensure proper JSON serialization
  const jsonString = JSON.stringify(request);
  if (serverProcess.stdin) {
    serverProcess.stdin.write(jsonString + '\n');
  }
}

// Function to send a request to generate an image
function sendGenerateImageRequest(): void {
  const request = {
    jsonrpc: '2.0',
    id: '2',
    method: 'tools/call',
    params: {
      name: 'generate_image',
      arguments: {
        prompt: 'A beautiful sunset over mountains',
        model: 'dall-e-3',
        size: '1024x1024'
      }
    }
  };
  
  console.log('\nSending generate_image request:');
  console.log(JSON.stringify(request, null, 2));
  
  // Ensure proper JSON serialization
  const jsonString = JSON.stringify(request);
  if (serverProcess.stdin) {
    serverProcess.stdin.write(jsonString + '\n');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down test client...');
  serverProcess.kill();
  process.exit(0);
});

// Start by sending a request to list tools
setTimeout(() => {
  sendListToolsRequest();
}, 1000);

console.log('MCP Server Test Client started. Press Ctrl+C to exit.');
