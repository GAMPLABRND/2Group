"use client";

import { useState } from "react";
import { Button, DescList, Modal, Table, Td } from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { AuditRow } from "@/types";

const columns = [
  { label: "일시", width: "200px" },
  { label: "분류", width: "80px" },
  { label: "행위자", width: "130px" },
  { label: "행위", width: "130px" },
  { label: "대상", width: "150px" },
  { label: "변경 요약", nowrap: false },
  { label: "사유", width: "120px", nowrap: false },
  { label: "상세", width: "88px", align: "center" as const },
];

function shown(value: string) {
  return value.trim() || "해당 없음";
}

export default function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [selected, setSelected] = useState<AuditRow | null>(null);

  return (
    <>
      <Table columns={columns} empty="조회 조건에 해당하는 감사추적이 없습니다." density="compact">
        {rows.map((row) => (
          <tr key={row.id}>
            <Td nowrap code>{toKST(row.timestamp_kst, true)}</Td>
            <Td code>{row.category}</Td>
            <Td clamp={2}>{row.actor_name || row.actor_id}<br />{row.role}</Td>
            <Td clamp={2}>{row.action}</Td>
            <Td clamp={2}>{row.target}</Td>
            <Td clamp={2}>{shown(row.before_value)} → {shown(row.after_value)}</Td>
            <Td clamp={2}>{shown(row.reason)}</Td>
            <Td align="center">
              <Button type="button" size="sm" variant="secondary" onClick={() => setSelected(row)}>
                상세
              </Button>
            </Td>
          </tr>
        ))}
      </Table>
      <Modal
        open={selected !== null}
        title="감사추적 상세"
        size="xl"
        onClose={() => setSelected(null)}
        footer={<Button type="button" variant="secondary" onClick={() => setSelected(null)}>닫기</Button>}
      >
        {selected ? (
          <DescList
            items={[
              { label: "ID", value: selected.id },
              { label: "분류", value: selected.category },
              { label: "행위자 ID", value: selected.actor_id },
              { label: "행위자 이름", value: selected.actor_name },
              { label: "역할", value: selected.role },
              { label: "행위", value: selected.action },
              { label: "대상", value: selected.target, full: true },
              { label: "변경 전", value: shown(selected.before_value), full: true },
              { label: "변경 후", value: shown(selected.after_value), full: true },
              { label: "사유", value: shown(selected.reason), full: true },
              { label: "기록 일시", value: toKST(selected.timestamp_kst, true), full: true },
            ]}
          />
        ) : null}
      </Modal>
    </>
  );
}
