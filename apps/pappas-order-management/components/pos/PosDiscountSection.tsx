import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from './pos.styles';

type Props = {
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  onSelectPreset: (percent: number) => void;
  onOpenMore: () => void;
};

const PRESET_DISCOUNTS = [10, 15, 20, 25];

export function PosDiscountSection({
  discountLabel,
  discountAmount,
  activeDiscountPercent,
  onSelectPreset,
  onOpenMore,
}: Props) {
  return (
    <View style={[styles.discountCard, discountAmount > 0 ? styles.discountCardActive : null]}>
      <View style={styles.discountCardText}>
        <Text style={[styles.discountCardTitle, discountAmount > 0 ? styles.discountCardTitleActive : null]}>
          Discount
        </Text>
        <Text style={[styles.discountCardValue, discountAmount > 0 ? styles.discountCardValueActive : null]}>
          {discountLabel}
        </Text>
      </View>
      <Text style={[styles.discountCardAmount, discountAmount > 0 ? styles.discountCardAmountActive : null]}>
        {discountAmount > 0 ? `-$${discountAmount.toFixed(2)}` : 'Add'}
      </Text>
      <View style={styles.discountPresetRow}>
        {PRESET_DISCOUNTS.map((percent) => {
          const selected = activeDiscountPercent === percent;
          return (
            <TouchableOpacity
              key={percent}
              style={[styles.discountPresetChip, selected ? styles.discountPresetChipActive : null]}
              onPress={() => onSelectPreset(percent)}
              accessibilityRole="button"
              accessibilityLabel={`Apply ${percent} percent discount`}
            >
              <Text style={[styles.discountPresetChipText, selected ? styles.discountPresetChipTextActive : null]}>
                {percent}%
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.discountPresetChip}
          onPress={onOpenMore}
          accessibilityRole="button"
          accessibilityLabel="More discount options"
        >
          <Text style={styles.discountPresetChipText}>More</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
