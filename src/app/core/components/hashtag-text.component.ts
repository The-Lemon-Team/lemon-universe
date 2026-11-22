import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TextHashtagSegment, tokenizeTextWithHashtags } from '../utils/hashtag.utils';

@Component({
  selector: 'app-hashtag-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline;
      }
    `,
  ],
  templateUrl: './hashtag-text.component.html'
})
export class HashtagTextComponent {
  readonly text = input.required<string>();
  readonly activeTag = input<string | null>(null);
  readonly interactive = input<boolean>(true);

  readonly hashtagClick = output<string>();

  readonly segments = computed<TextHashtagSegment[]>(() =>
    tokenizeTextWithHashtags(this.text() || ''),
  );

  onHashtagClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    this.hashtagClick.emit(tag);
  }
}
