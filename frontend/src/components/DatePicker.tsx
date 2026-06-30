import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";

import { COLORS, FONTS, RADIUS, SPACING } from "@/src/theme";

LocaleConfig.locales["pt-br"] = {
  monthNames: [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ],
  monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  today: "Hoje",
};
LocaleConfig.defaultLocale = "pt-br";

type Props = {
  visible: boolean;
  selected?: string; // yyyy-mm-dd
  onClose: () => void;
  onSelect: (date: string) => void;
};

export default function DatePickerModal({ visible, selected, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>SELECIONE A DATA</Text>
            <Pressable testID="date-picker-close" onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.inkDim} />
            </Pressable>
          </View>
          <Calendar
            testID="calendar-grid"
            current={selected || undefined}
            markedDates={
              selected
                ? {
                    [selected]: {
                      selected: true,
                      selectedColor: COLORS.accent,
                      selectedTextColor: COLORS.bg,
                    },
                  }
                : undefined
            }
            onDayPress={(day) => {
              onSelect(day.dateString);
              onClose();
            }}
            firstDay={0}
            theme={{
              backgroundColor: COLORS.surface,
              calendarBackground: COLORS.surface,
              dayTextColor: COLORS.ink,
              monthTextColor: COLORS.ink,
              textDisabledColor: COLORS.surface3,
              arrowColor: COLORS.accent,
              todayTextColor: COLORS.accent,
              textDayFontFamily: FONTS.text,
              textMonthFontFamily: FONTS.display,
              textDayHeaderFontFamily: FONTS.mono,
              textDayFontWeight: "500",
              textMonthFontWeight: "700",
              textSectionTitleColor: COLORS.inkDim,
              selectedDayBackgroundColor: COLORS.accent,
              selectedDayTextColor: COLORS.bg,
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderTopWidth: 3,
    borderTopColor: COLORS.accent,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.ink,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
});
