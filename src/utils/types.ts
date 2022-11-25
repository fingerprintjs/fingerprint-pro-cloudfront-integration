export type NonNullableObject<T> = {
  [K in keyof T]: NonNullable<T[K]>
}
