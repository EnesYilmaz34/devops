#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

const JAEGER_URL = process.env.JAEGER_URL || 'http://localhost:16686';

const program = new Command();

program
  .name('tracectl')
  .description('Jaeger/OpenTelemetry trace ve log kontrol aracı')
  .version('1.0.0');

// ---------------------------------------------------------------------------
// tracectl services  →  Jaeger'a trace gönderen tüm servisleri listeler
// ---------------------------------------------------------------------------
program
  .command('services')
  .description('Trace gönderen tüm servisleri listeler')
  .action(async () => {
    try {
      const res = await fetch(`${JAEGER_URL}/api/services`);
      const { data } = await res.json();

      if (!data || data.length === 0) {
        console.log(chalk.yellow('Henüz hiçbir servisten trace gelmemiş. Önce uygulamana birkaç istek at.'));
        return;
      }

      console.log(chalk.bold('\nTrace gönderen servisler:\n'));
      data.forEach((s) => console.log('  •', chalk.cyan(s)));
      console.log();
    } catch (err) {
      printConnectionError(err);
    }
  });

// ---------------------------------------------------------------------------
// tracectl traces --service api-gateway --limit 10
// ---------------------------------------------------------------------------
program
  .command('traces')
  .description('Belirtilen servise ait son trace\'leri listeler')
  .requiredOption('-s, --service <isim>', 'servis adı (örn. api-gateway, user-service, task-service)')
  .option('-l, --limit <sayı>', 'kaç trace gösterilsin', '10')
  .option('--errors-only', 'sadece hata içeren trace\'leri göster', false)
  .action(async (opts) => {
    try {
      const url = `${JAEGER_URL}/api/traces?service=${encodeURIComponent(opts.service)}&limit=${opts.limit}`;
      const res = await fetch(url);
      const { data } = await res.json();

      if (!data || data.length === 0) {
        console.log(chalk.yellow(`"${opts.service}" için trace bulunamadı.`));
        return;
      }

      console.log(chalk.bold(`\n${opts.service} — son ${data.length} trace:\n`));

      data.forEach((trace) => {
        const rootSpan = trace.spans.reduce((a, b) => (a.startTime < b.startTime ? a : b));
        const durationMs = (rootSpan.duration / 1000).toFixed(1);
        const hasError = trace.spans.some((s) =>
          s.tags?.some((t) => t.key === 'error' && t.value === true)
        );

        if (opts.errorsOnly && !hasError) return;

        const status = hasError ? chalk.red('✗ HATA') : chalk.green('✓ OK');
        const durationColor = durationMs > 500 ? chalk.red : durationMs > 150 ? chalk.yellow : chalk.green;

        console.log(
          `  ${status}  ${chalk.gray(trace.traceID.slice(0, 12))}  ${chalk.bold(rootSpan.operationName)}  ${durationColor(durationMs + 'ms')}  (${trace.spans.length} span)`
        );
      });
      console.log(chalk.gray(`\nDetay için: tracectl trace <traceID>\n`));
    } catch (err) {
      printConnectionError(err);
    }
  });

// ---------------------------------------------------------------------------
// tracectl trace <traceID>  →  tek bir trace'in tüm span'lerini zaman çizelgesi gibi gösterir
// ---------------------------------------------------------------------------
program
  .command('trace <traceID>')
  .description('Tek bir trace\'in tüm servisler arası yolculuğunu detaylı gösterir')
  .action(async (traceID) => {
    try {
      const res = await fetch(`${JAEGER_URL}/api/traces/${traceID}`);
      const { data } = await res.json();

      if (!data || data.length === 0) {
        console.log(chalk.yellow('Trace bulunamadı. ID doğru mu?'));
        return;
      }

      const trace = data[0];
      const processes = trace.processes;
      const sorted = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
      const traceStart = sorted[0].startTime;

      console.log(chalk.bold(`\nTrace ${traceID}\n`));

      sorted.forEach((span) => {
        const serviceName = processes[span.processID]?.serviceName || '?';
        const offsetMs = ((span.startTime - traceStart) / 1000).toFixed(1);
        const durationMs = (span.duration / 1000).toFixed(1);
        const hasError = span.tags?.some((t) => t.key === 'error' && t.value === true);
        const marker = hasError ? chalk.red('●') : chalk.green('●');

        const bar = '─'.repeat(Math.min(40, Math.max(1, Math.round(durationMs / 5))));

        console.log(
          `  ${marker} ${chalk.cyan(serviceName.padEnd(14))} ${chalk.bold(span.operationName.padEnd(28))} ` +
          `+${offsetMs}ms  ${chalk.gray(bar)} ${durationMs}ms`
        );

        if (hasError) {
          const errorLog = span.logs?.find((l) => l.fields.some((f) => f.key === 'message'));
          if (errorLog) {
            const msg = errorLog.fields.find((f) => f.key === 'message')?.value;
            console.log(chalk.red(`      ↳ ${msg}`));
          }
        }
      });
      console.log();
    } catch (err) {
      printConnectionError(err);
    }
  });

// ---------------------------------------------------------------------------
// tracectl logs --service task-service [--k8s]
// ---------------------------------------------------------------------------
program
  .command('logs')
  .description('Bir servisin canlı loglarını takip eder (docker-compose veya k8s)')
  .requiredOption('-s, --service <isim>', 'servis adı (örn. task-service)')
  .option('--k8s', 'Kubernetes\'ten oku (varsayılan: docker-compose)', false)
  .option('--tail <sayı>', 'son kaç satır gösterilsin (sadece k8s)', '50')
  .action((opts) => {
    console.log(chalk.gray(`${opts.service} logları takip ediliyor... (çıkmak için Ctrl+C)\n`));

    const child = opts.k8s
      ? spawn('kubectl', ['logs', '-l', `app=${opts.service}`, '-f', '--tail', opts.tail])
      : spawn('docker-compose', ['logs', '-f', opts.service]);

    child.stdout.on('data', (d) => process.stdout.write(colorizeLogLine(d.toString())));
    child.stderr.on('data', (d) => process.stderr.write(d.toString()));
    child.on('error', (err) => {
      console.error(chalk.red(`Komut çalıştırılamadı: ${err.message}`));
      console.error(chalk.gray(opts.k8s ? 'kubectl kurulu ve PATH\'te mi?' : 'docker-compose kurulu ve PATH\'te mi?'));
    });
  });

function colorizeLogLine(line) {
  if (/ERROR|Exception/i.test(line)) return chalk.red(line);
  if (/WARN/i.test(line)) return chalk.yellow(line);
  return line;
}

function printConnectionError(err) {
  console.error(chalk.red(`\nJaeger'a bağlanılamadı (${JAEGER_URL}).`));
  console.error(chalk.gray(`Detay: ${err.message}`));
  console.error(chalk.gray(`\nKontrol et:`));
  console.error(chalk.gray(`  - docker-compose up ile Jaeger çalışıyor mu?`));
  console.error(chalk.gray(`  - kubectl port-forward service/jaeger 16686:16686 yaptın mı?`));
  console.error(chalk.gray(`  - Farklı bir adres kullanıyorsan: JAEGER_URL=http://... tracectl ...\n`));
}

program.parse();
