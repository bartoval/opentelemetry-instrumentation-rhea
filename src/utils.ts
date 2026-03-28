import type { Sender, Receiver, Connection, Message, SenderOptions, ReceiverOptions } from 'rhea';

type Link = Sender | Receiver;
type LinkOptionsWithTarget = SenderOptions | ReceiverOptions;

interface LocalAttach {
  target?: { address?: string };
  source?: { address?: string };
}

const getLocalAttachAddress = (link: Link): string | undefined => {
  const local = (link as unknown as { local?: { attach?: LocalAttach } }).local?.attach;

  if (!local) return undefined;
  if (link.is_sender()) return local.target?.address;

  return local.source?.address ?? local.target?.address;
};

const resolveTerminusAddress = (
  terminus: string | { address?: string } | undefined
): string | undefined => {
  if (!terminus) return undefined;
  if (typeof terminus === 'string') return terminus;

  return terminus.address;
};

export const getDestinationAddress = (link: Link): string => {
  const { source, target } = link;

  if (link.is_receiver() && source?.address) return source.address;
  if (target?.address) return target.address;

  const localAddress = getLocalAttachAddress(link);

  if (localAddress) return localAddress;

  const opts = link.options as LinkOptionsWithTarget;
  const optTargetAddress = resolveTerminusAddress(opts?.target);

  if (optTargetAddress) return optTargetAddress;

  const optSourceAddress = resolveTerminusAddress(opts?.source);

  if (optSourceAddress) return optSourceAddress;

  return link.name ?? 'unknown';
};

export const getPublishSpanName = (address: string): string => `${address} publish`;

export const getConsumeSpanName = (address: string): string => `${address} receive`;

export const getNetworkPeerAddress = (connection: Connection): string | undefined => {
  const options = connection.options as unknown as Record<string, unknown>;

  return (options?.host as string) ?? connection.options?.hostname ?? connection.hostname;
};

export const getNetworkPeerPort = (connection: Connection): number | undefined => {
  const { options } = connection;

  return 'port' in options ? (options.port as number) : undefined;
};

export const getContainerId = (connection: Connection): string | undefined =>
  connection.container_id ?? connection.container?.id;

export const getMessageBodySize = (msg: Message): number | undefined => {
  const { body } = msg;

  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body)) return body.length;
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');

  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return undefined;
  }
};

export const ensureApplicationProperties = (msg: Message): Record<string, string> => {
  if (!msg.application_properties) {
    msg.application_properties = {};
  }

  return msg.application_properties as Record<string, string>;
};
