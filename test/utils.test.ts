import * as assert from 'assert';
import {
  getDestinationAddress,
  getPublishSpanName,
  getConsumeSpanName,
  getNetworkPeerAddress,
  getNetworkPeerPort,
  getContainerId,
  getMessageBodySize,
  ensureApplicationProperties,
} from '../src/utils';

function mockSender(overrides: Record<string, any>): any {
  return {
    is_sender: () => true,
    is_receiver: () => false,
    source: overrides.source ?? undefined,
    target: overrides.target ?? undefined,
    options: overrides.options ?? {},
    name: overrides.name ?? undefined,
    local: overrides.local ?? undefined,
  };
}

function mockReceiver(overrides: Record<string, any>): any {
  return {
    is_sender: () => false,
    is_receiver: () => true,
    source: overrides.source ?? undefined,
    target: overrides.target ?? undefined,
    options: overrides.options ?? {},
    name: overrides.name ?? undefined,
    local: overrides.local ?? undefined,
  };
}

function mockConnection(overrides: Record<string, any>): any {
  return {
    options: overrides.options ?? {},
    hostname: overrides.hostname ?? undefined,
    container_id: overrides.container_id ?? undefined,
    container: overrides.container ?? undefined,
  };
}

describe('utils', () => {
  describe('getDestinationAddress', () => {
    it('should return source address for receiver', () => {
      const receiver = mockReceiver({ source: { address: 'my-queue' } });
      assert.strictEqual(getDestinationAddress(receiver), 'my-queue');
    });

    it('should return target address for sender', () => {
      const sender = mockSender({ target: { address: 'my-queue' } });
      assert.strictEqual(getDestinationAddress(sender), 'my-queue');
    });

    it('should fall back to local attach address', () => {
      const sender = mockSender({
        local: { attach: { target: { address: 'local-addr' } } },
      });
      assert.strictEqual(getDestinationAddress(sender), 'local-addr');
    });

    it('should fall back to options target', () => {
      const sender = mockSender({ options: { target: 'opts-addr' } });
      assert.strictEqual(getDestinationAddress(sender), 'opts-addr');
    });

    it('should fall back to link name', () => {
      const sender = mockSender({ name: 'link-name' });
      assert.strictEqual(getDestinationAddress(sender), 'link-name');
    });

    it('should return "unknown" when nothing available', () => {
      const sender = mockSender({});
      assert.strictEqual(getDestinationAddress(sender), 'unknown');
    });
  });

  describe('span names', () => {
    it('should format publish span name', () => {
      assert.strictEqual(getPublishSpanName('my-queue'), 'my-queue publish');
    });

    it('should format consume span name with "process"', () => {
      assert.strictEqual(getConsumeSpanName('my-queue'), 'my-queue process');
    });
  });

  describe('getNetworkPeerAddress', () => {
    it('should return hostname from options', () => {
      assert.strictEqual(
        getNetworkPeerAddress(mockConnection({ options: { hostname: 'broker.example.com' } })),
        'broker.example.com'
      );
    });

    it('should fall back to connection hostname', () => {
      assert.strictEqual(
        getNetworkPeerAddress(mockConnection({ options: {}, hostname: 'broker.example.com' })),
        'broker.example.com'
      );
    });

    it('should return undefined when not set', () => {
      assert.strictEqual(getNetworkPeerAddress(mockConnection({ options: {} })), undefined);
    });
  });

  describe('getNetworkPeerPort', () => {
    it('should return port from options', () => {
      assert.strictEqual(getNetworkPeerPort(mockConnection({ options: { port: 5672 } })), 5672);
    });

    it('should return undefined when not set', () => {
      assert.strictEqual(getNetworkPeerPort(mockConnection({ options: {} })), undefined);
    });
  });

  describe('getContainerId', () => {
    it('should return container_id from connection', () => {
      assert.strictEqual(
        getContainerId(mockConnection({ container_id: 'my-container', options: {} })),
        'my-container'
      );
    });

    it('should fall back to container.id', () => {
      assert.strictEqual(
        getContainerId(mockConnection({ container: { id: 'fallback-id' }, options: {} })),
        'fallback-id'
      );
    });

    it('should return undefined when not set', () => {
      assert.strictEqual(getContainerId(mockConnection({ options: {} })), undefined);
    });
  });

  describe('getMessageBodySize', () => {
    it('should return buffer length', () => {
      assert.strictEqual(getMessageBodySize({ body: Buffer.from('hello') } as any), 5);
    });

    it('should return byte length for string', () => {
      assert.strictEqual(getMessageBodySize({ body: 'hello' } as any), 5);
    });

    it('should return JSON byte length for object', () => {
      const body = { key: 'value' };
      const expected = Buffer.byteLength(JSON.stringify(body), 'utf8');
      assert.strictEqual(getMessageBodySize({ body } as any), expected);
    });

    it('should return undefined for null body', () => {
      assert.strictEqual(getMessageBodySize({ body: null } as any), undefined);
    });

    it('should return undefined for undefined body', () => {
      assert.strictEqual(getMessageBodySize({ body: undefined } as any), undefined);
    });
  });

  describe('ensureApplicationProperties', () => {
    it('should create application_properties if missing', () => {
      const msg: any = {};
      const result = ensureApplicationProperties(msg);
      assert.deepStrictEqual(result, {});
      assert.strictEqual(msg.application_properties, result);
    });

    it('should return existing application_properties', () => {
      const msg: any = { application_properties: { existing: 'value' } };
      const result = ensureApplicationProperties(msg);
      assert.strictEqual(result.existing, 'value');
    });
  });
});
