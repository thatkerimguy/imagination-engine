// Document Doctor: scans the workspace for corrupt data and broken links, and repairs them
// (always quarantining the damaged value first). Logic lives in src/diagnostics/.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  formatReport,
  kvFromAdapter,
  repairAll,
  repairIssue,
  scanWorkspaceFull,
  summaryLine,
  type Issue,
  type ScanOptions,
  type ScanReport,
} from '../diagnostics/doctor.ts';
import { collectDiagnosticInput } from '../diagnostics/diagnostic-input.ts';
import { DoctorRow } from '../diagnostics/DoctorRow.tsx';
import { buildRedactedDiagnosticReport } from '../diagnostics/redact-report.ts';
import { deliverText } from '../export/deliver.ts';
import { fileExists } from '../diagnostics/file-exists.ts';
import { shareText } from '../security/share-text.ts';
import { createDefaultAdapter } from '../storage/adapter';
import { useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { EmptyState, Page, SectionLabel } from '../ui/Page.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';

export default function DoctorScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const kv = useMemo(() => kvFromAdapter(createDefaultAdapter()), []);
  const opts = useMemo<ScanOptions>(() => ({ fileExists }), []);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(false);

  const scan = useCallback(async () => {
    setBusy(true);
    try {
      setReport(await scanWorkspaceFull(kv, opts));
    } finally {
      setBusy(false);
    }
  }, [kv, opts]);
  useEffect(() => {
    void scan();
  }, [scan]);

  const repairOne = async (issue: Issue): Promise<void> => {
    await repairIssue(kv, issue, opts);
    repo.clearCache();
    repo.notifyChanged();
    await scan();
  };
  const fixAll = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Repair all',
      message:
        'Damaged data is copied to a quarantine area first, then links are fixed. Nothing is deleted without a backup copy.',
      confirmLabel: 'Repair all',
    });
    if (!ok) return;
    await repairAll(kv, opts);
    repo.clearCache();
    repo.notifyChanged();
    await scan();
  };

  const exportReport = async (): Promise<void> => {
    if (!report) return;
    const input = await collectDiagnosticInput(repo, kv, report.issues, report.scanned);
    const name = `kinetic-diagnostics-${new Date(input.now).toISOString().slice(0, 10)}.txt`;
    await deliverText(name, buildRedactedDiagnosticReport(input), 'text/plain').catch(
      () => undefined,
    );
  };

  if (!report) return null;
  const { issues, scanned } = report;
  const fixable = issues.some((i) => i.repair);
  return (
    <Page>
      <Txt variant="meta" color="inkSecondary" testID="doctor-summary">
        {summaryLine(issues, scanned)}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        <ActionButton
          variant="secondary"
          compact
          icon="refresh-cw"
          label="Rescan"
          disabled={busy}
          onPress={() => void scan()}
          testID="doctor-scan"
        />
        <ActionButton
          variant="secondary"
          compact
          icon="copy"
          label="Copy diagnostics"
          onPress={() => void shareText(formatReport(issues, scanned), 'Diagnostics')}
          testID="doctor-copy"
        />
        <ActionButton
          variant="secondary"
          compact
          icon="download"
          label="Export diagnostic report"
          onPress={() => void exportReport()}
          testID="doctor-export-report"
        />
        {fixable ? (
          <ActionButton
            compact
            icon="tool"
            label="Repair all"
            onPress={() => void fixAll()}
            testID="doctor-repair-all"
          />
        ) : null}
      </View>
      {issues.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="All clear"
          body="No problems found in your library."
        />
      ) : (
        <>
          <SectionLabel>Findings</SectionLabel>
          <View>
            {issues.map((issue, i) => (
              <DoctorRow
                key={issue.id}
                issue={issue}
                index={i}
                onRepair={(x) => void repairOne(x)}
              />
            ))}
          </View>
        </>
      )}
    </Page>
  );
}
