"use client";

import { useEffect, useState } from "react";
import { Banner, Button, Modal, Table, Td } from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { UnreadAlarm } from "@/lib/alarm-notifications";

export default function UnreadAlarmPopup() {
  const [alarms, setAlarms] = useState<UnreadAlarm[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/alarms/unread", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { alarms?: UnreadAlarm[]; error?: string } | null;
        if (!response.ok) throw new Error(body?.error || "미확인 알람을 조회하지 못했습니다.");
        if (active) setAlarms(body?.alarms || []);
      })
      .catch((fetchError: unknown) => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : "미확인 알람을 조회하지 못했습니다.");
      });
    return () => { active = false; };
  }, []);

  async function acknowledge(alarm: UnreadAlarm, moveToDetail: boolean) {
    if (pendingKey) return;
    setPendingKey(alarm.key);
    setError("");
    try {
      const response = await fetch("/api/alarms/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarm_key: alarm.key }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "알람을 확인 처리하지 못했습니다.");
      setAlarms((current) => current.filter((item) => item.key !== alarm.key));
      if (moveToDetail) window.location.assign(alarm.detailHref);
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : "알람을 확인 처리하지 못했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Modal
      open={!dismissed && alarms.length > 0}
      title={`미확인 알람 (${alarms.length}건)`}
      onClose={() => setDismissed(true)}
      size="xl"
      footer={<Button type="button" variant="secondary" onClick={() => setDismissed(true)}>나중에 확인</Button>}
    >
      {error ? <Banner kind="error">{error}</Banner> : null}
      <Table columns={[
        { label: "알람 발생 일시", width: "180px" },
        { label: "구분(유형)", width: "130px" },
        { label: "대상 장비/사용자", width: "190px", nowrap: false },
        { label: "주요 알람 내용", nowrap: false },
        { label: "처리", width: "190px", align: "center" },
      ]} density="compact">
        {alarms.map((alarm) => (
          <tr key={alarm.key}>
            <Td nowrap code>{toKST(alarm.occurredAt, true)}</Td>
            <Td>{alarm.type}</Td>
            <Td clamp={2}>{alarm.target}</Td>
            <Td clamp={3}>{alarm.content}</Td>
            <Td align="center">
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" disabled={Boolean(pendingKey)} onClick={() => acknowledge(alarm, false)}>
                  확인(읽음)
                </Button>
                <Button type="button" disabled={Boolean(pendingKey)} onClick={() => acknowledge(alarm, true)}>
                  상세 이동
                </Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </Modal>
  );
}
