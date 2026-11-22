import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ICON_CATEGORIES,
  ICON_CATALOG,
  IconCatalogItem,
  IconCategoryItem,
  QUICK_FAVORITE_ICONS,
  findIconItem,
  getIconLabel,
} from './icon-catalog';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon-picker.component.html',
  styles: [
    `
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `,
  ],
})
export class IconPickerComponent {
  @Input() value: string = 'casino';
  @Input() label: string = 'Иконка (Material)';
  @Input() showQuickFavorites: boolean = true;

  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly iconSelected = new EventEmitter<IconCatalogItem>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  readonly quickFavorites = QUICK_FAVORITE_ICONS;
  readonly totalCount = ICON_CATALOG.length;

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly selectedCategory = signal<string>('all');
  readonly tempSelectedIcon = signal<string>('casino');
  readonly customSymbolInput = signal<string>('');

  readonly currentLabel = computed(() => {
    return getIconLabel(this.value);
  });

  readonly categoriesWithCounts = computed(() => {
    const counts = new Map<string, number>();
    counts.set('all', ICON_CATALOG.length);
    for (const item of ICON_CATALOG) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return ICON_CATEGORIES.map((cat) => ({
      ...cat,
      count: counts.get(cat.id) || 0,
    }));
  });

  readonly filteredIcons = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    return ICON_CATALOG.filter((item) => {
      // 1. Category check
      if (cat !== 'all' && item.category !== cat) {
        return false;
      }

      // 2. Search query check
      if (!q) {
        return true;
      }

      if (item.name.toLowerCase().includes(q)) return true;
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.keywords.some((k) => k.toLowerCase().includes(q))) return true;

      return false;
    });
  });

  getLabel(name: string): string {
    return getIconLabel(name);
  }

  openPicker(): void {
    this.tempSelectedIcon.set(this.value || 'casino');
    this.searchQuery.set('');
    this.customSymbolInput.set('');
    this.isOpen.set(true);

    setTimeout(() => {
      this.searchInputElement?.nativeElement?.focus();
    }, 50);
  }

  closePicker(): void {
    this.isOpen.set(false);
  }

  selectQuickIcon(iconName: string): void {
    this.confirmSelection(iconName);
  }

  pickTemp(iconName: string): void {
    this.tempSelectedIcon.set(iconName);
  }

  applyCustomSymbol(): void {
    const sym = this.customSymbolInput().trim().toLowerCase().replace(/\s+/g, '_');
    if (!sym) return;
    this.confirmSelection(sym);
  }

  confirmSelection(iconName: string): void {
    const finalName = (iconName || 'casino').trim();
    this.value = finalName;
    this.valueChange.emit(finalName);

    const catalogItem = findIconItem(finalName) || {
      name: finalName,
      label: finalName,
      category: 'custom',
      keywords: [finalName],
    };
    this.iconSelected.emit(catalogItem);

    this.closePicker();
  }
}
