import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "69372780a2b13cffb4447b0e", 
  requiresAuth: true // Ensure authentication is required for all operations
});
