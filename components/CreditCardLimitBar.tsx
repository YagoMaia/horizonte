import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '@/lib/utils';

interface CreditCardLimitBarProps {
  limiteTotal: number;
  limiteUtilizado: number;
}

export function CreditCardLimitBar({ limiteTotal, limiteUtilizado }: CreditCardLimitBarProps) {
  const limiteDisponivel = Math.max(0, limiteTotal - limiteUtilizado);
  const porcentagemUsoBruta = limiteTotal > 0 ? (limiteUtilizado / limiteTotal) * 100 : 0;
  const porcentagemUso = Math.min(porcentagemUsoBruta, 100);

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${porcentagemUso}%` }]} />
      </View>
      
      <View style={styles.infoContainer}>
        <View>
          <Text style={styles.valueText}>{formatCurrency(limiteUtilizado)}</Text>
          <Text style={styles.labelText}>Utilizado</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.valueText}>{formatCurrency(limiteDisponivel)}</Text>
          <Text style={styles.labelText}>Disponível</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FF8C00', // Laranja de destaque
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  valueText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  labelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
