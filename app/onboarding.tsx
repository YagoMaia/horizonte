import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const STEPS = [
  {
    id: '1',
    title: 'Bem-vindo ao Horizonte',
    description: 'Seu gestor financeiro offline-first. Simples, privado e focado no que importa.',
    icon: 'compass-outline',
    color: '#FF69B4', // Rosa
  },
  {
    id: '2',
    title: 'Preveja o Futuro',
    description: 'A tela Horizonte projeta seu saldo para os próximos 30 dias, considerando seus gastos fixos e variáveis.',
    icon: 'calendar-outline',
    color: '#FFD700', // Amarelo
  },
  {
    id: '3',
    title: 'Fluxo de Caixa',
    description: 'Visualize lançamentos futuros e recorrentes para nunca ser pego de surpresa no final do mês.',
    icon: 'trending-up-outline',
    color: '#FF4500', // Vermelho/Laranja
  },
  {
    id: '4',
    title: 'Controle Total',
    description: 'Gerencie contas e cartões de crédito com faturas automáticas em um só lugar.',
    icon: 'wallet-outline',
    color: '#FF8C00', // Laranja Escuro
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { completeOnboarding } = useStoreContext();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(width);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  const renderItem = ({ item }: { item: typeof STEPS[0] }) => (
    <View style={[styles.slide, { width: layoutWidth }]}>
      <View style={styles.slideInner}>
        <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
          <Ionicons name={item.icon as any} size={90} color={item.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {item.description}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <FlatList
          ref={flatListRef}
          data={STEPS}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / layoutWidth);
            setCurrentIndex(index);
          }}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: layoutWidth,
            offset: layoutWidth * index,
            index,
          })}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      </View>

      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? colors.primary : colors.border,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === STEPS.length - 1 ? 'Começar' : 'Próximo'}
          </Text>
          <Ionicons
            name={currentIndex === STEPS.length - 1 ? 'arrow-forward' : 'chevron-forward'}
            size={20}
            color="#FFF"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.15, // Empurra o conteúdo para baixo
    paddingHorizontal: 40,
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
