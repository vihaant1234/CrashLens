/**
 * Zero-Allocation Circular Ring Buffer
 * Pre-allocated fixed-capacity buffer that overwrites the oldest element in O(1).
 * Eliminates garbage collector churn during continuous 1Hz telemetry updates.
 */

export class CircularRingBuffer<T> {
  private readonly capacity: number;
  private readonly buffer: (T | undefined)[];
  private head: number = 0; // Next write index
  private count: number = 0; // Current number of stored elements

  constructor(capacity: number = 60) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('CircularRingBuffer capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.buffer = new Array<T | undefined>(capacity);
  }

  /**
   * Appends an item to the buffer, overwriting the oldest entry in O(1) if capacity is reached.
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Returns all stored items in chronological order (oldest to newest).
   */
  toArray(): T[] {
    if (this.count === 0) {
      return [];
    }

    const result = new Array<T>(this.count);

    if (this.count < this.capacity) {
      // Buffer not full yet: items are from 0 to count - 1
      for (let i = 0; i < this.count; i++) {
        result[i] = this.buffer[i] as T;
      }
    } else {
      // Buffer full: oldest is at this.head, newest is at (this.head - 1 + capacity) % capacity
      let readIdx = this.head;
      for (let i = 0; i < this.capacity; i++) {
        result[i] = this.buffer[readIdx] as T;
        readIdx = (readIdx + 1) % this.capacity;
      }
    }

    return result;
  }

  /**
   * Returns the most recently pushed item without removing it.
   */
  latest(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const latestIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIndex];
  }

  /**
   * Resets the buffer without re-allocating memory.
   */
  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = undefined;
    }
    this.head = 0;
    this.count = 0;
  }

  /**
   * Returns the current number of elements in the buffer.
   */
  get size(): number {
    return this.count;
  }

  /**
   * Returns maximum capacity of the buffer.
   */
  get maxCapacity(): number {
    return this.capacity;
  }
}
