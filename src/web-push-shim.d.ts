declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  const webpush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (sub: PushSubscription, payload: string) => Promise<unknown>;
  };

  export default webpush;
}
