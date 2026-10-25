import { detenerTodo } from "./procesos";

export default async function globalTeardown() {
  await detenerTodo();
}
