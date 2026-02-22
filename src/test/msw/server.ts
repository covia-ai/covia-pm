import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server instance for integration tests.
 *
 * Each test file that uses this server manages its own lifecycle:
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 *
 * We do NOT add this to the global setup.ts so that unit tests which spy on
 * global.fetch directly are not affected.
 */
export const server = setupServer(...handlers);
