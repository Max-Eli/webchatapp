import { notFound } from "next/navigation";
import { isValidRoomId } from "@/lib/roomId";
import { RoomClient } from "@/components/RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidRoomId(id)) notFound();
  return <RoomClient roomId={id} />;
}
