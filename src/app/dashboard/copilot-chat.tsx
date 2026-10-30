"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import TaskConfirmation from "./task-confirmation";
import EventConfirmation from "./event-confirmation";
import type { SavedTask } from "@/lib/plan-storage";
import type { NewCalendarEvent } from "@/lib/event-cloud";

type ChatMessage = {
  id?: string;
  taskStatus?: "legacy" | "pending" | "saved" | "cancelled";
  eventStatus?: "legacy" | "pending" | "saved" | "cancelled";
  role: "user" | "assistant";
  content: string;
  proposedTask?: SavedTask | null;
  proposedTasks?: SavedTask[];
  taskDecisions?: Array<{
    taskIndex: number;
    decision: "saved" | "cancelled";
  }>;
  proposedEvent?: NewCalendarEvent | null;

};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskProposal(
  value: unknown
): value is Omit<SavedTask, "completed"> {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 200 &&
    (value.priority === "Alta" ||
      value.priority === "Média" ||
      value.priority === "Normal") &&
    (typeof value.dueDate === "string" || value.dueDate === null)
  );
}

export default function CopilotChat() {
function isEventProposal(
  value: unknown
): value is NewCalendarEvent {
  if (!isRecord(value)) return false;

  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 200
  ) {
    return false;
  }

  if (
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string"
  ) {
    return false;
  }

  const start = new Date(value.startsAt);
  const end = new Date(value.endsAt);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  ) {
    return false;
  }

  return (
    (value.location === null ||
      typeof value.location === "string") &&
    (value.eventType === "appointment" ||
      value.eventType === "unavailable") &&
    typeof value.blocksTime === "boolean"
  );
}
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingTask, setPendingTask] = useState<SavedTask | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

const [listening, setListening] = useState(false);
