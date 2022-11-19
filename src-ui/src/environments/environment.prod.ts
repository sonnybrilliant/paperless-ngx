const base_url = new URL(document.baseURI)

export const environment = {
  production: true,
  apiBaseUrl: document.baseURI + 'api/',
  apiVersion: '2',
  appTitle: 'NWU Archive',
  version: '1.9.2',
  webSocketHost: window.location.host,
  webSocketProtocol: window.location.protocol == 'https:' ? 'wss:' : 'ws:',
  webSocketBaseUrl: base_url.pathname + 'ws/',
}
