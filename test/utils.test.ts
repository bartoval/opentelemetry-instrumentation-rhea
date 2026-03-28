import * as assert from 'assert';
import type { Sender, Receiver, Connection, Message } from 'rhea';
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

function mockSender(partial: Record<string, unknown>): Sender {
  return { is_sender: () => true, is_receiver: () => false, ...partial } as unknown as Sender;
}

function mockReceiver(partial: Record<string, unknown>): Receiver {
  return { is_sender: () => false, is_receiver: () => true, ...partial } as unknown as Receiver;
}

function mockConnection(partial: Record<string, unknown>): Connection {
  return partial as unknown as Connection;
}

function mockMessage(partial: Record<string, unknown>): Message {
  return partial as unknown as Message;
}

describe('utils', () => {
  describe('getDestinationAddress', () => {
    it('should return target address for sender', () => {
      const sender = mockSender({ target: { address: 'my-queue' } });

      assert.strictEqual(getDestinationAddress(sender), 'my-queue');
    });

    it('should return source address for receiver', () => {
      const receiver = mockReceiver({ source: { address: 'my-queue' } });

      assert.strictEqual(getDestinationAddress(receiver), 'my-queue');
    });

    it('should fall back to target address for receiver', () => {
      const receiver = mockReceiver({ target: { address: 'target-queue' } });

      assert.strictEqual(getDestinationAddress(receiver), 'target-queue');
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

    it('should format consume span name', () => {
      assert.strictEqual(getConsumeSpanName('my-queue'), 'my-queue receive');
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
        getContainerId(mockConnection({ options: {}, container: { id: 'container-id' } })),
        'container-id'
      );
    });
  });

  describe('getMessageBodySize', () => {
    it('should return buffer length for Buffer body', () => {
      assert.strictEqual(getMessageBodySize(mockMessage({ body: Buffer.from('hello') })), 5);
    });

    it('should return byte length for string body', () => {
      assert.strictEqual(getMessageBodySize(mockMessage({ body: 'hello' })), 5);
    });

    it('should return byte length for object body', () => {
      const body = { key: 'value' };
      const expected = Buffer.byteLength(JSON.stringify(body), 'utf8');
      assert.strictEqual(getMessageBodySize(mockMessage({ body })), expected);
    });

    it('should return undefined for null body', () => {
      assert.strictEqual(getMessageBodySize(mockMessage({ body: null })), undefined);
    });

    it('should return undefined for undefined body', () => {
      assert.strictEqual(getMessageBodySize(mockMessage({})), undefined);
    });
  });

  describe('ensureApplicationProperties', () => {
    it('should create application_properties if not present', () => {
      const msg = mockMessage({});
      const props = ensureApplicationProperties(msg);
      assert.deepStrictEqual(props, {});
      assert.strictEqual(msg.application_properties, props);
    });

    it('should return existing application_properties', () => {
      const existing = { key: 'value' };
      const msg = mockMessage({ application_properties: existing });
      const props = ensureApplicationProperties(msg);
      assert.strictEqual(props, existing);
    });
  });
});
