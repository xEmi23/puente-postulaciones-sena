import { matarTodo } from "./procesos";

export default async function globalTeardown() {
  matarTodo();
}
