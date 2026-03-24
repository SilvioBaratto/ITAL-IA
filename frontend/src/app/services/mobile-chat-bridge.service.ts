import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileChatBridgeService {
  /** Whether the mobile chat input bar is visible (set true by ChatbotComponent on init). */
  readonly showInput = signal(false);

  /** Current value of the mobile input field — kept in sync with the desktop input. */
  readonly userInput = signal('');

  /** Whether a message is currently streaming — drives the mobile send button disabled state. */
  readonly isLoading = signal(false);

  private sendCallback?: (msg: string) => void;
  private inputChangeCallback?: (msg: string) => void;

  /**
   * Called by ChatbotComponent on ngOnInit to wire the mobile input back into
   * the component's message-sending logic.
   */
  register(callbacks: { send: (msg: string) => void; inputChange: (msg: string) => void }): void {
    this.sendCallback = callbacks.send;
    this.inputChangeCallback = callbacks.inputChange;
  }

  /** Called by ChatbotComponent on ngOnDestroy to detach the callbacks and hide the bar. */
  unregister(): void {
    this.sendCallback = undefined;
    this.inputChangeCallback = undefined;
  }

  /** Triggered by BottomTabBarComponent when the user taps Send. Delegates to ChatbotComponent. */
  send(message: string): void {
    this.sendCallback?.(message);
  }

  /**
   * Triggered by BottomTabBarComponent as the user types.
   * Updates the shared userInput signal AND notifies ChatbotComponent so it
   * can keep its own local userInput signal in sync (used by the desktop input).
   */
  notifyInputChange(text: string): void {
    this.userInput.set(text);
    this.inputChangeCallback?.(text);
  }
}
