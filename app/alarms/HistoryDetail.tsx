"use client";

import { useState } from "react";
import { Button, DescList, Modal } from "@/components/ui";
import { toKST } from "@/lib/kst";

type Decision = {
  id: string;
  status: string;
  requestedAt: string;
  confirmedAt: string;
  confirmedBy: string;
  rejectionReason: string;
};

const statusLabels: Record<string, string> = {
  REQUESTED: "사용 재개 요청",
  APPROVED: "승인",
  REJECTED: "반려",
};

export default function HistoryDetail({ decisions }: { decisions: Decision[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>상세</Button>
      <Modal
        open={open}
        title="사용 재개 이력"
        size="xl"
        onClose={() => setOpen(false)}
        footer={<Button type="button" variant="secondary" onClick={() => setOpen(false)}>닫기</Button>}
      >
        {decisions.length ? decisions.map((decision, index) => (
          <div key={decision.id} className={index ? "mt-5" : ""}>
            <DescList items={[
              { label: "요청 ID", value: decision.id },
              { label: "상태", value: statusLabels[decision.status] ?? decision.status },
              { label: "요청 일시", value: decision.requestedAt ? toKST(decision.requestedAt, true) : "해당 없음" },
              { label: "결정 일시", value: decision.confirmedAt ? toKST(decision.confirmedAt, true) : "해당 없음" },
              { label: "확인자", value: decision.confirmedBy || "해당 없음" },
              { label: "반려 사유", value: decision.rejectionReason || "해당 없음", full: true },
            ]} />
          </div>
        )) : <p>사용 재개 요청 이력이 없습니다.</p>}
      </Modal>
    </>
  );
}
