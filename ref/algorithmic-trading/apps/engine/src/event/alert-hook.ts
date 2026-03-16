/** 알림 메시지 */
export interface AlertMessage {
  level: 'info' | 'warn' | 'error';
  title: string;
  body: string;
  timestamp: string;
}

/** 알림 발송 인터페이스 (Phase 4에서 Telegram 등 구현) */
export interface AlertSink {
  send(message: AlertMessage): Promise<void>;
}

/** 콘솔 출력 AlertSink (기본 구현) */
export class ConsoleAlertSink implements AlertSink {
  async send(message: AlertMessage): Promise<void> {
    const prefix =
      message.level === 'error'
        ? '[ERROR]'
        : message.level === 'warn'
          ? '[WARN]'
          : '[INFO]';
    console.log(
      `${prefix} ${message.title}: ${message.body} (${message.timestamp})`
    );
  }
}
