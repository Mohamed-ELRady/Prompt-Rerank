export {
  MESSAGE_KIND,
  messageDefinitions,
  envelopeSchema,
  type MessageType,
  type MessageInput,
  type MessageOutput,
} from './protocol';
export { sendMessage, registerMessageHandlers, type MessageHandlers } from './messenger';
export {
  definePortProtocol,
  connectPort,
  onPortConnect,
  type PortProtocol,
  type PortClient,
  type PortSession,
} from './port';
