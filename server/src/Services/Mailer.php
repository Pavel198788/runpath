<?php
declare(strict_types=1);

namespace RunPath\Services;

use RunPath\Config;

/**
 * Письма: подтверждение почты и сброс пароля. На shared-хостинге — mail(); SMTP — простой клиент без библиотек.
 * В тестах письма пишутся в лог.
 */
final class Mailer
{
    /** @var array<int, array{to: string, subject: string, body: string}> */
    public static array $sent = [];

    public function __construct(private Config $config, private Logger $logger)
    {
    }

    public function send(string $to, string $subject, string $body): bool
    {
        if ($this->config->isTesting()) {
            self::$sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];
            return true;
        }
        $from = $this->config->get('MAIL_FROM', 'noreply@localhost');
        if ($this->config->get('MAIL_DRIVER', 'mail') === 'smtp') {
            return $this->smtp($to, $subject, $body, $from);
        }
        $headers = "From: {$from}\r\nContent-Type: text/plain; charset=utf-8\r\n";
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
        if (!$ok) {
            $this->logger->error('mail() failed', ['to' => $to]);
        }
        return $ok;
    }

    private function smtp(string $to, string $subject, string $body, string $from): bool
    {
        $host = $this->config->get('SMTP_HOST');
        $port = $this->config->int('SMTP_PORT', 587);
        $sock = @stream_socket_client(($port === 465 ? 'ssl://' : '') . $host . ':' . $port, $errno, $errstr, 10);
        if (!$sock) {
            $this->logger->error('smtp connect failed', ['err' => $errstr]);
            return false;
        }
        $read = fn() => fgets($sock, 512);
        $cmd = function (string $c) use ($sock, $read) {
            fwrite($sock, $c . "\r\n");
            $line = $read();
            while ($line !== false && isset($line[3]) && $line[3] === '-') {
                $line = $read();
            }
            return $line ?: '';
        };
        $read();
        $cmd('EHLO runpath');
        if ($port !== 465) {
            $cmd('STARTTLS');
            stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $cmd('EHLO runpath');
        }
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($this->config->get('SMTP_USER')));
        $cmd(base64_encode($this->config->get('SMTP_PASS')));
        $cmd("MAIL FROM:<{$from}>");
        $cmd("RCPT TO:<{$to}>");
        $cmd('DATA');
        $msg = "From: {$from}\r\nTo: {$to}\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{$body}\r\n.";
        $res = $cmd($msg);
        $cmd('QUIT');
        fclose($sock);
        return str_starts_with($res, '250');
    }
}
